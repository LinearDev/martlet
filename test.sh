#! /bin/bash

# Get the host from the first argument
if [ -z "$1" ]; then
    echo "Usage: $0 <host>"
    exit 1
fi

# Test Jenkins webhook
curl -X POST $1/jenkins-webhook \
-H "Content-Type: application/json" \
-d '{
  "name": "test-job",
  "display_name": "Test Job",
  "build": {
    "full_url": "$1/job/test-job/123",
    "number": 123,
    "phase": "COMPLETED",
    "status": "SUCCESS",
    "duration": 45000,
    "timestamp": "'"$(date +%s)000"'",
    "scm": {
      "url": "https://github.com/user/repo",
      "branch": "main",
      "commit": "abc123",
      "committer": "John Doe"
    }
  }
}'