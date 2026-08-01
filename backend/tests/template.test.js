import test from "node:test";
import assert from "node:assert/strict";
import {
  renderTemplate,
  unresolvedTemplateVariables
} from "../src/utils/template.js";

test("reemplaza variables de una plantilla", () => {
  const rendered = renderTemplate(
    "Hola {{ nombre }}, tu plan {{plan}} vence el {{fecha}}.",
    { nombre: "Aldo", plan: "Mensual", fecha: "30/07/2026" }
  );
  assert.equal(
    rendered,
    "Hola Aldo, tu plan Mensual vence el 30/07/2026."
  );
  assert.deepEqual(unresolvedTemplateVariables(rendered), []);
});

test("detecta variables que faltan", () => {
  const rendered = renderTemplate("Hola {{nombre}}, paga {{monto}}", {
    nombre: "Aldo"
  });
  assert.deepEqual(unresolvedTemplateVariables(rendered), ["monto"]);
});
