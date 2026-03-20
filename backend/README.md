# Phase 2 - Cloud Dashboard (Diet Analytics)

## Project Overview

This project builds a cloud-based data analytics dashboard using Microsoft Azure. It processes a dataset of diet and nutritional information and exposes the results through a backend API for use in a frontend dashboard.

The backend is implemented using Azure Functions and reads data from Azure Blob Storage, returning structured JSON for visualization.

## Backend Summary

The backend API performs the following:

- Reads `All_Diets.csv` from Azure Blob Storage
- Processes nutritional data using Python and pandas
- Returns JSON formatted for frontend charts and UI
- Supports filtering, search, and pagination

## API Endpoint

`https://phase2dietapidaws-dubxfghcfkgfhsbr.eastus2-01.azurewebsites.net/api/nutritional-insights`

## Required App Settings

- `AZURE_STORAGE_CONNECTION_STRING`
- `BLOB_CONTAINER_NAME`
- `BLOB_FILE_NAME`
