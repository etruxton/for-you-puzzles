# Docker Setup Instructions

## Quick Start with Docker Compose

1. Build and run the container:
```bash
docker-compose up --build
```

2. Access the application at: http://localhost:5000

3. To stop the container:
```bash
docker-compose down
```

## Manual Docker Commands

If you prefer not to use docker-compose:

1. Build the Docker image:
```bash
docker build -t for-you-puzzles .
```

2. Run the container:
```bash
docker run -p 5000:5000 for-you-puzzles
```

## Debugging WebSocket Issues

To see detailed logs:
```bash
docker-compose logs -f
```

## Development Mode

The docker-compose.yml mounts your local directory as a volume, so changes to your code will be reflected without rebuilding (though you'll need to restart the container for Python changes).

To rebuild after changing requirements.txt:
```bash
docker-compose build
docker-compose up
```