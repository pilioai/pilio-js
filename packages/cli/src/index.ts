#!/usr/bin/env node
import { PilioClient } from "@pilio/sdk";
import { createCommandRunner } from "./commands";

const apiKey = process.env.PILIO_API_KEY;

if (!apiKey) {
  console.error("PILIO_API_KEY is required.");
  process.exitCode = 1;
} else {
  const clientOptions = process.env.PILIO_BASE_URL ? { apiKey, baseURL: process.env.PILIO_BASE_URL } : { apiKey };
  const client = new PilioClient(clientOptions);
  const run = createCommandRunner({ client });

  run(process.argv.slice(2)).catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
