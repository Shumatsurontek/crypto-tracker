# Use an official Python runtime as a parent image
FROM python:3.10-slim AS base

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE 1 # Prevents python from writing pyc files
ENV PYTHONUNBUFFERED 1       # Prevents python from buffering stdout/stderr

# Set the working directory in the container
WORKDIR /app

# Install system dependencies if needed (e.g., for psycopg2, uncomment below)
# RUN apt-get update && apt-get install -y --no-install-recommends gcc libpq-dev && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
# Copy only requirements first to leverage Docker cache
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application code
COPY . .

# Expose the port the app runs on (should match PORT in .env or default in app.py)
EXPOSE 3001

# Default command for development (will be overridden by docker-compose.dev.yml)
# Use Flask's built-in server with debug and reload
CMD ["flask", "run", "--host=0.0.0.0", "--port=3001"]

# --- Production Stage (Optional but Recommended) ---
# You might want a separate production stage later using gunicorn
# FROM base AS production
# Expose the port Gunicorn will run on
# EXPOSE 3001
# Command to run the app using Gunicorn
# CMD ["gunicorn", "--bind", "0.0.0.0:3001", "app:app"] 