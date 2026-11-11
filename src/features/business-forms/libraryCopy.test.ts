import { expect, it } from "vitest";
import { suggestedPrefix } from "./libraryCopy";

it("suggests the standard's prefix or a numbered one within twelve characters", () => {
  expect(suggestedPrefix({ prefix: "FAC", copies: 0 })).toBe("FAC");
  expect(suggestedPrefix({ prefix: "FAC", copies: 2 })).toBe("FAC3");
  expect(suggestedPrefix({ prefix: "ABCDEFGHIJKL", copies: 9 })).toBe("ABCDEFGHIJ10");
});
