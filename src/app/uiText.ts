export const imageUiText = {
  status: {
    empty: "画像未読み込み",
    loading: "読み込み中",
    loaded: "読み込み済み",
    loadingCanvas: "画像を読み込んでいます",
  },
  canvas: {
    empty: "画像を読み込むと、ここに表示されます",
  },
  preview: {
    title: "プレビュー表示",
    replacement: "色置換",
    lineArt: "線画",
    thresholdLabel: "線画のしきい値",
    thresholdUnit: "%",
    colorWeightLabel: "色差の重み",
    colorWeightUnit: "%",
  },
  colorPicker: {
    title: "色を選択",
    hint: "Canvas上の色をクリックすると、置換対象色として選択できます。",
    targetLabel: "置換対象色",
    selectedOutputLabel: "選択中の置換対象色",
    replacementLabel: "置換後の色",
    replacementOutputLabel: "置換後の色コード",
    unselected: "未選択",
  },
  colorReplacement: {
    toleranceLabel: "許容範囲",
    toleranceUnit: "%",
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
