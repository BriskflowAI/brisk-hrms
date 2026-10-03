FROM mcr.microsoft.com/devcontainers/base:ubuntu-24.04

# What Frappe needs to build and run: MariaDB client libraries, PDF printing, fonts.
RUN apt-get update \
	&& apt-get install -y --no-install-recommends \
		build-essential pkg-config libmariadb-dev mariadb-client redis-tools \
		libffi-dev libssl-dev xvfb libfontconfig wkhtmltopdf cron \
	&& rm -rf /var/lib/apt/lists/*
