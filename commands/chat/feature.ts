import {Agent} from "@tokenring-ai/agent";
import {ChatModelRegistry} from "@tokenring-ai/ai-client/ModelRegistry";
import {FeatureOptions} from "@tokenring-ai/ai-client/ModelTypeRegistry";
import ChatService from "../../ChatService.ts";

function parseModelAndFeatures(model: string): { base: string; features: FeatureOptions } {
  const qIndex = model.indexOf("?");
  const base = qIndex >= 0 ? model.substring(0, qIndex) : model;
  const features: FeatureOptions = Object.create(null);
  if (qIndex >= 0) {
    const query = model.substring(qIndex + 1);
    for (const part of query.split("&")) {
      if (!part) continue;
      const [rawK, rawV] = part.split("=");
      const k = decodeURIComponent(rawK);
      const v = rawV === undefined ? "1" : decodeURIComponent(rawV);
      features[k] = coerceFeatureValue(v);
    }
  }
  return {base, features};
}

function coerceFeatureValue(v: string): any {
  const lower = v.toLowerCase?.();
  if (v === "1" || lower === "true") return true;
  if (v === "0" || lower === "false") return false;
  const asNum = Number(v);
  if (!Number.isNaN(asNum) && String(asNum) === v.replace(/(?<=\d)\.0+$/, (m) => m)) {
    return asNum;
  }
  return v;
}

function serializeModel(base: string, features: FeatureOptions): string {
  const entries = Object.entries(features).filter(([, v]) => v !== undefined);
  if (entries.length === 0) return base;
  const query = entries
    .map(([k, v]) => {
      let val: string;
      if (typeof v === "boolean") val = v ? "1" : "0";
      else val = String(v);
      return `${encodeURIComponent(k)}=${encodeURIComponent(val)}`;
    })
    .join("&");
  return `${base}?${query}`;
}

export default async function feature(remainder: string, agent: Agent): Promise<void> {
  const chatService = agent.requireServiceByType(ChatService);
  const currentModel = chatService.requireModel(agent);
  const {base, features} = parseModelAndFeatures(currentModel);

  const args = remainder?.trim()?.split(/\s+/);
  const action = args[0];
  if (!action || !["list", "enable", "disable"].includes(action)) {
    agent.errorLine(
      "Usage: /chat feature <list|enable|disable> [key[=value] ...]",
    );
    return;
  }

  if (action === "list") {
    agent.infoLine(`Current model: ${currentModel}`);
    agent.infoLine(`Base model: ${base}`);

    // Show enabled features
    const keys = Object.keys(features);
    if (keys.length === 0) {
      agent.infoLine("Enabled features: (none)");
    } else {
      agent.infoLine("Enabled features:");
      for (const k of keys.sort()) {
        agent.infoLine(`  ${k}: ${features[k]}`);
      }
    }

    // Show available features from the model spec
    try {
      const chatModelRegistry = agent.requireServiceByType(ChatModelRegistry);
      const client = await chatModelRegistry.getClient(base);
      const modelSpec = client.getModelSpec();
      const availableFeatures = modelSpec.features || {};
      const availableKeys = Object.keys(availableFeatures);

      if (availableKeys.length === 0) {
        agent.infoLine("Available features: (none)");
      } else {
        agent.infoLine("Available features:");
        for (const k of availableKeys.sort()) {
          agent.infoLine(`  ${k}`);
        }
      }
    } catch (error) {
      agent.infoLine(`Available features: (could not fetch model spec: ${error})`);
    }

    return;
  }

  if (action === "enable") {
    if (args.length < 2) {
      agent.errorLine("/chat feature enable requires at least one key or key=value");
      return;
    }
    for (let i = 1; i < args.length; i++) {
      const token = args[i];
      const eq = token.indexOf("=");
      if (eq === -1) {
        features[token] = true;
      } else {
        const key = token.substring(0, eq);
        const val = token.substring(eq + 1);
        if (!key) {
          agent.errorLine(`Invalid feature token: ${token}`);
          continue;
        }
        features[key] = coerceFeatureValue(val);
      }
    }
    const newModel = serializeModel(base, features);
    chatService.setModel(newModel, agent);
    agent.infoLine(`Enabled features. New model: ${newModel}`);
    return;
  }

  // disable
  if (args.length < 2) {
    agent.errorLine("/chat feature disable requires at least one key");
    return;
  }
  for (let i = 1; i < args.length; i++) {
    const key = args[i];
    if (!key) continue;
    delete features[key];
  }
  const newModel = serializeModel(base, features);
  chatService.setModel(newModel, agent);
  agent.infoLine(`Disabled features. New model: ${newModel}`);
}