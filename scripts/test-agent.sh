#!/bin/bash
# Script to test a Hermes agent

echo "🧪 Testing Hermes Agent..."

if [ -z "$1" ]; then
    echo "Usage: bash scripts/test-agent.sh [agent-name]"
    echo "Example: bash scripts/test-agent.sh hello-agent"
    exit 1
fi

AGENT_DIR="agents/$1"

if [ ! -d "$AGENT_DIR" ]; then
    echo "❌ Agent not found: $AGENT_DIR"
    exit 1
fi

cd "$AGENT_DIR"
hermes test
