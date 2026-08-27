import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import App from "./App";

describe("初期画面", () => {
  it("画像未読み込みのワークスペースを表示する", () => {
    render(<App />);

    expect(
      screen.getByRole("heading", { name: "塗装後の色を、写真で確認する" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "ツール" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Canvas" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "履歴" })).toBeInTheDocument();
    expect(screen.getByText("画像未読み込み")).toBeInTheDocument();
  });
});
