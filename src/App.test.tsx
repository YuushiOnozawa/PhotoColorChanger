import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import App from "./App";

afterEach(cleanup);

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

  it("対応外形式は現在の状態を維持してエラーを表示する", async () => {
    render(<App />);

    fireEvent.change(screen.getByLabelText("画像ファイル"), {
      target: {
        files: [new File(["text"], "notes.txt", { type: "text/plain" })],
      },
    });

    expect(await screen.findByRole("alert")).toHaveTextContent("対応形式はJPEG、PNG、WebPです");
    expect(screen.getByText("画像未読み込み")).toBeInTheDocument();
  });
});
