import { expect, it } from "vitest";
import { normalizeLink, linksInText } from "./attachments";
it("готовит кликабельные ссылки и отвергает исполняемые схемы", () => {
  expect(normalizeLink("example.com/path")).toBe("https://example.com/path");
  expect(() => normalizeLink("javascript:alert(1)")).toThrow();
  expect(() => normalizeLink("file:///secret")).toThrow();
  expect(() => normalizeLink("https://user:pass@example.com")).toThrow();
  expect(
    linksInText("Сайт https://example.com/a. Повтор https://example.com/a."),
  ).toEqual(["https://example.com/a"]);
});
