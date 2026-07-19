import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { PrivacyPolicy, TermsOfService } from "./Legal";

describe("legal pages", () => {
  it("describes the data retained by the official instance", () => {
    render(<MemoryRouter><PrivacyPolicy /></MemoryRouter>);

    expect(screen.getByRole("heading", { name: "Privacy Policy", level: 1 })).toBeInTheDocument();
    expect(screen.getByText(/does not connect to Roblox accounts/i)).toBeInTheDocument();
    expect(screen.getByText(/Dock and follower records are permanently removed/i)).toBeInTheDocument();
    expect(screen.getByText(/routing records for relayed messages/i)).toBeInTheDocument();
  });

  it("sets cross-server conduct and administrator expectations", () => {
    render(<MemoryRouter><TermsOfService /></MemoryRouter>);

    expect(screen.getByRole("heading", { name: "Terms of Service", level: 1 })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Unofficial community project", level: 2 })).toBeInTheDocument();
    expect(screen.getByText(/administrators must clearly inform members/i)).toBeInTheDocument();
    expect(screen.getByText(/You keep ownership of content/i)).toBeInTheDocument();
  });
});
