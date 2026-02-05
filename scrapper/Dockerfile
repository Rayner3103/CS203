FROM python:3.11-slim

# Install cron and clean up
RUN apt-get update && apt-get install -y cron && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy requirements and install
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the code
COPY . .

# Create the cron job file
# This runs the script every day at midnight. 
# Adjust "0 0 * * *" to your preferred schedule.
RUN echo "0 0 * * * cd /app && /usr/local/bin/python main.py >> /var/log/cron.log 2>&1" > /etc/cron.d/wits-scraper
RUN chmod 0644 /etc/cron.d/wits-scraper
RUN crontab /etc/cron.d/wits-scraper

# Create log file for tailing
RUN touch /var/log/cron.log

# Run cron in the foreground
CMD ["cron", "-f"]