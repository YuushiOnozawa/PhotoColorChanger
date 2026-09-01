export const imageUiText = {
  status: {
    empty: "画像未読み込み",
    loading: "読み込み中",
    loaded: "読み込み済み",
    loadingCanvas: "画像を読み込んでいます",
  },
  errors: {
    unsupported:
      "対応形式はJPEG、PNG、WebPです。ファイル形式を確認して、もう一度選択してください。",
    invalid: "画像を読み込めませんでした。破損していないJPEG、PNG、WebPを選び直してください。",
  },
  notices: {
    resized: "画像が大きいため、長辺4096px以下に縮小しました。",
  },
} as const;
