import { useEffect, useMemo, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  PieChart,
  Pie,
  Cell,
  ScatterChart,
  Scatter,
  ZAxis,
} from "recharts";
import "./App.css";

const API_BASE =
  "https://phase2dietapidaws-dubxfghcfkgfhsbr.eastus2-01.azurewebsites.net/api/nutritional-insights";

const PIE_COLORS = ["#2563eb", "#16a34a", "#f59e0b", "#dc2626", "#7c3aed", "#0891b2"];

function App() {
  const [dietType, setDietType] = useState("all");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshTick, setRefreshTick] = useState(0);
  const [error, setError] = useState("");

  const queryString = useMemo(() => {
    const params = new URLSearchParams({
      dietType,
      search,
      page: String(page),
      pageSize: String(pageSize),
    });

    return `${API_BASE}?${params.toString()}`;
  }, [dietType, search, page, pageSize]);

  useEffect(() => {
    const controller = new AbortController();

    async function fetchDashboardData() {
      try {
        setLoading(true);
        setError("");

        const response = await fetch(queryString, {
          method: "GET",
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`API request failed with status ${response.status}`);
        }

        const result = await response.json();
        setData(result);
      } catch (err) {
        if (err.name !== "AbortError") {
          setError(err.message || "Something went wrong while loading the dashboard.");
        }
      } finally {
        setLoading(false);
      }
    }

    fetchDashboardData();

    return () => controller.abort();
  }, [queryString, refreshTick]);

  const availableDietTypes = useMemo(() => {
    if (!data?.pieChart) return ["all"];

    const types = data.pieChart
      .map((item) => item.dietType)
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));

    return ["all", ...types];
  }, [data]);

  function handleApplySearch(e) {
    e.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  }

  function handleReset() {
    setDietType("all");
    setSearch("");
    setSearchInput("");
    setPage(1);
  }

  function handleRefresh() {
    setRefreshTick((prev) => prev + 1);
  }

  const recipes = data?.recipes?.items ?? [];
  const totalPages = data?.recipes?.totalPages ?? 1;

  return (
    <div className="app-shell">
      <header className="hero">
        <div>
          <h1>Cloud Diet Analytics Dashboard</h1>
          <p>
            Live nutrition insights powered by Azure Function App and ready for
            Azure frontend deployment.
          </p>
        </div>
      </header>

      <section className="card controls-card">
        <div className="section-title-row">
          <h2>Filters and Controls</h2>
        </div>

        <form className="controls-grid" onSubmit={handleApplySearch}>
          <div className="field">
            <label htmlFor="dietType">Diet Type</label>
            <select
              id="dietType"
              value={dietType}
              onChange={(e) => {
                setDietType(e.target.value);
                setPage(1);
              }}
            >
              {availableDietTypes.map((type) => (
                <option key={type} value={type}>
                  {type === "all" ? "All Diets" : type}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="search">Search Diet Type</label>
            <input
              id="search"
              type="text"
              placeholder="Example: keto"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>

          <div className="button-row">
            <button type="submit" className="btn btn-primary">
              Apply Search
            </button>
            <button type="button" className="btn" onClick={handleRefresh}>
              Refresh
            </button>
            <button type="button" className="btn btn-secondary" onClick={handleReset}>
              Reset
            </button>
          </div>
        </form>
      </section>

      <section className="stats-grid">
        <div className="card stat-card">
          <span className="stat-label">Total Records</span>
          <strong className="stat-value">{data?.recordCount ?? "--"}</strong>
        </div>

        <div className="card stat-card">
          <span className="stat-label">Execution Time</span>
          <strong className="stat-value">
            {data?.executionTimeMs != null ? `${data.executionTimeMs} ms` : "--"}
          </strong>
        </div>

        <div className="card stat-card">
          <span className="stat-label">Current Diet Filter</span>
          <strong className="stat-value">
            {data?.filtersApplied?.dietType || "all"}
          </strong>
        </div>

        <div className="card stat-card">
          <span className="stat-label">Current Search</span>
          <strong className="stat-value">
            {data?.filtersApplied?.search || "none"}
          </strong>
        </div>
      </section>

      {loading && (
        <section className="card status-card">
          <p>Loading dashboard data...</p>
        </section>
      )}

      {!loading && error && (
        <section className="card status-card error-card">
          <h3>Dashboard Error</h3>
          <p>{error}</p>
          <p>
            This usually means the API is unreachable or CORS has not been configured
            yet for the frontend domain.
          </p>
        </section>
      )}

      {!loading && !error && data && (
        <>
          <section className="charts-grid">
            <div className="card chart-card">
              <div className="section-title-row">
                <h2>Average Macronutrients by Diet Type</h2>
              </div>

              <div className="chart-wrapper">
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={data.barChart}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="Diet_type" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="Protein(g)" />
                    <Bar dataKey="Carbs(g)" />
                    <Bar dataKey="Fat(g)" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="card chart-card">
              <div className="section-title-row">
                <h2>Recipe Distribution by Diet Type</h2>
              </div>

              <div className="chart-wrapper">
                <ResponsiveContainer width="100%" height={320}>
                  <PieChart>
                    <Pie
                      data={data.pieChart}
                      dataKey="count"
                      nameKey="dietType"
                      outerRadius={110}
                      label
                    >
                      {data.pieChart.map((entry, index) => (
                        <Cell
                          key={`cell-${entry.dietType}-${index}`}
                          fill={PIE_COLORS[index % PIE_COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="card chart-card chart-card-wide">
              <div className="section-title-row">
                <h2>Protein vs Carbs Scatter Plot</h2>
              </div>

              <div className="chart-wrapper">
                <ResponsiveContainer width="100%" height={360}>
                  <ScatterChart>
                    <CartesianGrid />
                    <XAxis
                      type="number"
                      dataKey="Protein(g)"
                      name="Protein"
                      unit="g"
                    />
                    <YAxis
                      type="number"
                      dataKey="Carbs(g)"
                      name="Carbs"
                      unit="g"
                    />
                    <ZAxis type="number" dataKey="Fat(g)" range={[60, 400]} />
                    <Tooltip cursor={{ strokeDasharray: "3 3" }} />
                    <Legend />
                    <Scatter name="Recipes" data={data.scatter} />
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
            </div>
          </section>

          <section className="card clusters-card">
            <div className="section-title-row">
              <h2>Cluster Summary</h2>
            </div>

            <div className="cluster-grid">
              {data.clusters.map((cluster) => (
                <div className="cluster-item" key={cluster.cluster}>
                  <span className="cluster-name">{cluster.cluster}</span>
                  <strong className="cluster-count">{cluster.count}</strong>
                </div>
              ))}
            </div>
          </section>

          <section className="card recipes-card">
            <div className="section-title-row">
              <h2>Recipes</h2>
              <span className="muted">
                Page {data.recipes.page} of {data.recipes.totalPages}
              </span>
            </div>

            {recipes.length === 0 ? (
              <div className="empty-state">
                <p>No recipes matched the current filters.</p>
              </div>
            ) : (
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Recipe</th>
                      <th>Diet Type</th>
                      <th>Protein (g)</th>
                      <th>Carbs (g)</th>
                      <th>Fat (g)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recipes.map((recipe, index) => {
                      const recipeNameKey = Object.keys(recipe).find(
                        (key) =>
                          !["Diet_type", "Protein(g)", "Carbs(g)", "Fat(g)"].includes(key)
                      );

                      return (
                        <tr key={`${recipe[recipeNameKey]}-${index}`}>
                          <td>{recipe[recipeNameKey]}</td>
                          <td>{recipe["Diet_type"]}</td>
                          <td>{recipe["Protein(g)"]}</td>
                          <td>{recipe["Carbs(g)"]}</td>
                          <td>{recipe["Fat(g)"]}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <div className="pagination-row">
              <button
                className="btn"
                disabled={page <= 1}
                onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
              >
                Previous
              </button>

              <span className="muted">
                Showing page {page} of {totalPages}
              </span>

              <button
                className="btn"
                disabled={page >= totalPages}
                onClick={() => setPage((prev) => Math.min(prev + 1, totalPages))}
              >
                Next
              </button>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

export default App;