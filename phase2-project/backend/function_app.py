import json
import logging
import os
import time
from io import StringIO

import azure.functions as func
import pandas as pd

try:
    from azure.storage.blob import BlobServiceClient
except ImportError:
    BlobServiceClient = None


app = func.FunctionApp(http_auth_level=func.AuthLevel.ANONYMOUS)


def load_csv_data() -> pd.DataFrame:
    """
    Loads All_Diets.csv.
    First tries Azure Blob Storage if connection settings exist.
    Falls back to local All_Diets.csv for development/testing.
    """
    connection_string = os.getenv("AZURE_STORAGE_CONNECTION_STRING", "").strip()
    container_name = os.getenv("BLOB_CONTAINER_NAME", "").strip()
    blob_file_name = os.getenv("BLOB_FILE_NAME", "All_Diets.csv").strip()

    # Try Blob Storage first if settings are present
    if connection_string and container_name and BlobServiceClient is not None:
        blob_service_client = BlobServiceClient.from_connection_string(connection_string)
        blob_client = blob_service_client.get_blob_client(
            container=container_name,
            blob=blob_file_name
        )
        blob_data = blob_client.download_blob().readall().decode("utf-8")
        return pd.read_csv(StringIO(blob_data))

    # Fallback to local file
    return pd.read_csv("All_Diets.csv")


def clean_dataframe(df: pd.DataFrame) -> pd.DataFrame:
    """
    Cleans important numeric columns and standardizes diet type text.
    """
    numeric_cols = ["Protein(g)", "Carbs(g)", "Fat(g)"]

    for col in numeric_cols:
        df[col] = pd.to_numeric(df[col], errors="coerce")

    if "Diet_type" in df.columns:
        df["Diet_type"] = df["Diet_type"].astype(str).str.strip().str.lower()

    df = df.dropna(subset=numeric_cols)

    return df


def apply_filters(df: pd.DataFrame, diet_search: str, diet_filter: str) -> pd.DataFrame:
    """
    Applies search and dropdown filtering for diet type.
    """
    filtered_df = df.copy()

    if diet_search:
        filtered_df = filtered_df[
            filtered_df["Diet_type"].str.contains(diet_search.lower(), na=False)
        ]

    if diet_filter and diet_filter.lower() != "all":
        filtered_df = filtered_df[
            filtered_df["Diet_type"].str.lower() == diet_filter.lower()
        ]

    return filtered_df


def build_bar_chart(df: pd.DataFrame) -> list:
    """
    Average macronutrients by diet type.
    """
    avg_macros = (
        df.groupby("Diet_type")[["Protein(g)", "Carbs(g)", "Fat(g)"]]
        .mean()
        .reset_index()
    )

    avg_macros["Protein(g)"] = avg_macros["Protein(g)"].round(2)
    avg_macros["Carbs(g)"] = avg_macros["Carbs(g)"].round(2)
    avg_macros["Fat(g)"] = avg_macros["Fat(g)"].round(2)

    return avg_macros.to_dict(orient="records")


def build_heatmap(df: pd.DataFrame) -> list:
    """
    Same averages as bar chart, formatted for heatmap use.
    """
    avg_macros = (
        df.groupby("Diet_type")[["Protein(g)", "Carbs(g)", "Fat(g)"]]
        .mean()
        .reset_index()
    )

    avg_macros["Protein(g)"] = avg_macros["Protein(g)"].round(2)
    avg_macros["Carbs(g)"] = avg_macros["Carbs(g)"].round(2)
    avg_macros["Fat(g)"] = avg_macros["Fat(g)"].round(2)

    return avg_macros.to_dict(orient="records")


def build_scatter(df: pd.DataFrame, limit: int = 300) -> list:
    """
    Protein vs carbs, with fat included for point size.
    """
    scatter_df = df[["Diet_type", "Protein(g)", "Carbs(g)", "Fat(g)"]].copy().head(limit)

    scatter_df["Protein(g)"] = scatter_df["Protein(g)"].round(2)
    scatter_df["Carbs(g)"] = scatter_df["Carbs(g)"].round(2)
    scatter_df["Fat(g)"] = scatter_df["Fat(g)"].round(2)

    return scatter_df.to_dict(orient="records")


def build_pie_chart(df: pd.DataFrame) -> list:
    """
    Recipe distribution by diet type.
    """
    pie_df = (
        df["Diet_type"]
        .value_counts()
        .reset_index()
    )
    pie_df.columns = ["dietType", "count"]

    return pie_df.to_dict(orient="records")


def build_recipes(df: pd.DataFrame, page: int = 1, page_size: int = 10) -> dict:
    """
    Paginates recipe data for UI cards/table.
    """
    possible_name_columns = ["Recipe_name", "recipe_name", "Recipe", "Name"]
    recipe_name_col = next((c for c in possible_name_columns if c in df.columns), None)

    if recipe_name_col is None:
        recipe_name_col = df.columns[0]

    recipe_cols = [recipe_name_col, "Diet_type", "Protein(g)", "Carbs(g)", "Fat(g)"]
    recipe_cols = [c for c in recipe_cols if c in df.columns]

    recipes_df = df[recipe_cols].copy()

    start_index = (page - 1) * page_size
    end_index = start_index + page_size

    paged_df = recipes_df.iloc[start_index:end_index].copy()

    for col in ["Protein(g)", "Carbs(g)", "Fat(g)"]:
        if col in paged_df.columns:
            paged_df[col] = paged_df[col].round(2)

    return {
        "page": page,
        "pageSize": page_size,
        "totalRecipes": int(len(recipes_df)),
        "totalPages": int((len(recipes_df) + page_size - 1) / page_size),
        "items": paged_df.to_dict(orient="records")
    }


def build_clusters(df: pd.DataFrame) -> list:
    """
    Simple cluster-like grouping for UI placeholder.
    This is not ML clustering yet — it groups by high protein / high carbs / high fat.
    """
    clustered_df = df.copy()

    protein_mean = clustered_df["Protein(g)"].mean()
    carbs_mean = clustered_df["Carbs(g)"].mean()
    fat_mean = clustered_df["Fat(g)"].mean()

    def assign_cluster(row):
        if row["Protein(g)"] >= protein_mean and row["Protein(g)"] >= row["Carbs(g)"]:
            return "high_protein"
        if row["Carbs(g)"] >= carbs_mean and row["Carbs(g)"] >= row["Fat(g)"]:
            return "high_carbs"
        if row["Fat(g)"] >= fat_mean:
            return "high_fat"
        return "balanced"

    clustered_df["cluster"] = clustered_df.apply(assign_cluster, axis=1)

    cluster_counts = clustered_df["cluster"].value_counts().reset_index()
    cluster_counts.columns = ["cluster", "count"]

    return cluster_counts.to_dict(orient="records")


@app.route(route="nutritional-insights", methods=["GET"])
def nutritional_insights(req: func.HttpRequest) -> func.HttpResponse:
    logging.info("Nutritional insights request started.")
    start_time = time.time()

    try:
        diet_search = req.params.get("search", "").strip()
        diet_filter = req.params.get("dietType", "all").strip()
        page = int(req.params.get("page", 1))
        page_size = int(req.params.get("pageSize", 10))

        df = load_csv_data()
        df = clean_dataframe(df)
        df = apply_filters(df, diet_search, diet_filter)

        response_data = {
            "recordCount": int(len(df)),
            "executionTimeMs": 0,
            "filtersApplied": {
                "search": diet_search,
                "dietType": diet_filter,
                "page": page,
                "pageSize": page_size
            },
            "barChart": build_bar_chart(df),
            "heatmap": build_heatmap(df),
            "scatter": build_scatter(df),
            "pieChart": build_pie_chart(df),
            "recipes": build_recipes(df, page=page, page_size=page_size),
            "clusters": build_clusters(df)
        }

        response_data["executionTimeMs"] = int((time.time() - start_time) * 1000)

        return func.HttpResponse(
            json.dumps(response_data, indent=2),
            mimetype="application/json",
            status_code=200
        )

    except Exception as e:
        logging.exception("Error in nutritional insights function.")
        return func.HttpResponse(
            json.dumps({
                "error": str(e)
            }),
            mimetype="application/json",
            status_code=500
        )