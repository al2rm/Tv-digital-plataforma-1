import test from "node:test";
import assert from "node:assert/strict";
import {
  buildExistingChannelIndex,
  channelAlreadyExists
} from "../src/controllers/adminIptvImport.controller.js";

const source = "iptv-org-trial-py";
const channel = {
  sourceId: "source-a",
  manifestUrl: "https://cdn.example/live.m3u8"
};

test("un canal eliminado puede volver a importarse aunque otra señal del mismo origen comparta URL", () => {
  const index = buildExistingChannelIndex([
    { source, source_channel_id: "source-b", manifest_url: channel.manifestUrl }
  ], source);

  assert.equal(channelAlreadyExists(index, channel), false);
});

test("un canal existente del mismo origen se reconoce por su ID", () => {
  const index = buildExistingChannelIndex([
    { source, source_channel_id: channel.sourceId, manifest_url: "https://changed.example/live.m3u8" }
  ], source);

  assert.equal(channelAlreadyExists(index, channel), true);
});

test("una señal manual con la misma URL evita duplicados", () => {
  const index = buildExistingChannelIndex([
    { source: null, source_channel_id: null, manifest_url: channel.manifestUrl }
  ], source);

  assert.equal(channelAlreadyExists(index, channel), true);
});
