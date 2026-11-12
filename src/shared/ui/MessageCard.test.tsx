import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { MessageCard } from "./MessageCard";

it("presents caller-owned structured content while preserving title and description", () => {
  render(<MessageCard title="Visit" description="Form reply"><dl><dt>Client</dt><dd>Historical answer</dd></dl></MessageCard>);
  expect(screen.getByText("Visit")).toBeInTheDocument();
  expect(screen.getByText("Form reply")).toBeInTheDocument();
  expect(screen.getByText("Historical answer")).toBeInTheDocument();
});

// A photo WhatsApp sent without a file name is only «Foto»: the card has no second line.
it("leaves out the second line without a description", () => {
  const { container } = render(<MessageCard title="Foto" />);
  expect(screen.getByText("Foto")).toBeInTheDocument();
  expect(container.querySelectorAll("p")).toHaveLength(1);
});
