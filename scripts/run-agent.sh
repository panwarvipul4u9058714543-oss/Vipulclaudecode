#!/bin/bash
# Script to run a Hermes agent

echo "🤖 Starting Hermes Agent..."

if [ -z "$1" ]; then
    echo "Usage: bash scripts/run-agent.sh [agent-name]"
    echo "Example: bash scripts/run-agent.sh hello-agent"
    exit 1
fi

AGENT_DIR="agents/$1"

if [ ! -d "$AGENT_DIR" ]; then
    echo "❌ Agent not found: $AGENT_DIR"
    exit 1
fi

cd "$AGENT_DIR"
hermes run
