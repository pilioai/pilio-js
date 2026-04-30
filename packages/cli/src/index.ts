#!/usr/bin/env node
import { PilioClient } from "@pilio/sdk";
import { createCommandRunner } from "./commands";
import { shouldRequireAPIKey } from "./runtime";

const apiKey = process.env.PILIO_API_KEY;
const args = process.argv.slice(2);

if (!apiKey && shouldRequireAPIKey(args)) {
  console.error("PILIO_API_KEY is required.");
  process.exitCode = 1;
} else {
  const client = apiKey
    ? new PilioClient(process.env.PILIO_BASE_URL ? { apiKey, baseURL: process.env.PILIO_BASE_URL } : { apiKey })
    : ({} as PilioClient);
  const run = createCommandRunner({ client });

  run(args).catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
