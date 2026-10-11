import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { MessageCard } from "./MessageCard";

it("presents caller-owned structured content while preserving title and description", () => {
  render(<MessageCard title="Visit" description="Form reply"><dl><dt>Client</dt><dd>Historical answer</dd></dl></MessageCard>);
  expect(screen.getByText("Visit")).toBeInTheDocument();
  expect(screen.getByText("Form reply")).toBeInTheDocument();
  expect(screen.getByText("Historical answer")).toBeInTheDocument();
});
