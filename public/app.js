const DATA_BASE = "./data";
const BASE_VALUE = 100; // paths are rebased to $100 invested at the selected start date
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const ROLLING_COST_DAYS = 365;

const RANGE_PRESETS = {
  "1m": { label: "1M", days: 31 },
  "3m": { label: "3M", days: 92 },
  "6m": { label: "6M", days: 183 },
  ytd: { label: "YTD", ytd: true },
  "1y": { label: "1Y", days: 365 },
  "3y": { label: "3Y", days: 365 * 3 },
  "5y": { label: "5Y", days: 365 * 5 },
  "10y": { label: "10Y", days: 365 * 10 },
  max: { label: "Max", max: true },
};

const RESET_FREQUENCIES = ["none", "daily", "weekly", "monthly", "quarterly", "semiannual", "annual"];

const COLOR = {
  actual: "#5b9dff",
  perfect: "#4ade80",
  benchmark: "#a78bfa",
  naive: "#fbbf24",
  observed: "#5b9dff",
  financing: "#4ade80",
  residual: "#f87171",
  trackingDrag: "#f87171",
  compounding: "#4ade80",
  decay: "#a78bfa",
  axis: "#1f2733",
  text: "#e8edf4",
  muted: "#8593a6",
  grid: "#1f2733",
  tooltipBg: "#161b24",
};

const TIPS = {
  observed: `
    <h4>Model - ETF difference</h4>
    <p>The annualized difference between the compounded theoretical model return and the ETF's actual compounded return over the selected dates.</p>
    <p>Positive means the model return was higher than the ETF. Negative means the ETF beat the model over the selected range.</p>
  `,
  financing: `
    <h4>Estimated financing impact</h4>
    <p>The part of the model difference explained by benchmark short-term rates. Long leveraged funds usually pay financing on borrowed exposure, while inverse funds can receive a cash/collateral benefit.</p>
    <p>Calculated as <code>(leverage&nbsp;−&nbsp;1)&nbsp;×&nbsp;rate</code>, using SOFR (post 2018-04-03) blended with the Fed Funds rate before that. For a <code>-3×</code> ETF this is about <code>-4×</code> the cash rate before fund expenses and swap spreads.</p>
  `,
  residual: `
    <h4>Residual model difference</h4>
    <p>The remaining annualized model difference after removing the estimated financing impact. Positive means the ETF lagged the model after financing; negative means it beat the model after financing.</p>
    <p>This is a reconciliation bucket, not a fee. It can include expense ratio, swap/futures basis, collateral yield, execution timing, transaction costs, tracking error, and benchmark/data-basis effects.</p>
  `,
  paths: `
    <h4>$100 invested over selected range</h4>
    <p>Four scenarios for what $100 placed in this pair at the selected start date would be worth at the selected end date:</p>
    <ul>
      <li><strong>Actual ETF</strong> — what you'd actually have.</li>
      <li><strong>Theoretical return before fund costs</strong> — the target index daily return multiplied by leverage, after the estimated cash/financing rate, before fund expenses and tracking costs.</li>
      <li><strong>Configurable leverage benchmark</strong> — a synthetic benchmark that resets leverage by calendar schedule or when leverage drifts outside a chosen band.</li>
      <li><strong>Benchmark</strong> — the underlying 1× target index.</li>
    </ul>
    <p><strong>ETF - theoretical model</strong> is the cumulative model difference. <strong>Theoretical model - configurable leverage benchmark</strong> is the reset-frequency compounding effect after financing.</p>
  `,
  log: `
    <h4>Log vs linear scale</h4>
    <p>Log spaces the y-axis so equal-percentage moves look the same regardless of starting value. Useful for long histories with large dynamic range.</p>
    <p>Inverse leveraged ETFs (SQQQ, SPXU) often decay from <code>$100</code> to tiny values over long uptrends. On linear scale that can look flat near zero; log scale reveals the decline across multiple orders of magnitude.</p>
    <p>Log is undefined for non-positive numbers, so any line at or below zero is omitted. A synthetic leverage benchmark is also omitted after it falls to zero or below because that is not an investable account value.</p>
  `,
  "cost-vs-financing": `
    <h4>Model difference vs financing impact</h4>
    <p>Rolling annualized <strong>model - ETF</strong> difference overlaid with the estimated financing impact.</p>
    <p>Where the lines diverge is the residual model difference, not a fee line.</p>
    <p>Large jumps usually come from one or two extreme daily observations entering or leaving the lookback, not from a smooth expense suddenly changing.</p>
  `,
  "benchmark-model": `
    <h4>Configurable leverage benchmark</h4>
    <p>This line shows a synthetic leveraged benchmark with a reset rule you choose.</p>
  <p><strong>Calendar reset</strong> resets exposure to the target leverage at a fixed schedule, such as weekly, quarterly, or annually. <strong>Never</strong> means the benchmark does not rebalance during the selected range.</p>
    <p><strong>Leverage band</strong> can be used together with the calendar schedule. It lets exposure drift until the effective leverage moves outside the lower or upper bound, then resets it back to the target leverage at that close.</p>
    <p>When both are on, the band can trigger an earlier reset and the calendar schedule is the regular backstop.</p>
  `,
  decomp: `
    <h4>Where the gap comes from</h4>
    <p>The total gap between the ETF's actual return and the configurable leverage benchmark splits into:</p>
    <ul>
      <li><strong>Model difference</strong> = actual − theoretical return before fund costs.</li>
      <li><strong>Reset compounding / decay</strong> = theoretical return before fund costs − configurable leverage benchmark. Positive means the daily reset helped; negative means volatility decay hurt.</li>
    </ul>
    <p>By identity: <code>actual − leverage benchmark = (actual − theoretical) + (theoretical − leverage benchmark)</code>.</p>
  `,
  "cumulative-cost": `
    <h4>ETF - model difference</h4>
    <p>Difference between the actual ETF path and the theoretical return before fund costs, expressed as a percentage-point gap.</p>
    <p>Negative means the ETF underperformed the target path. Positive means it beat the target path over the selected range.</p>
  `,
  compounding: `
    <h4>Reset compounding / decay</h4>
    <p>Percentage-point gap between the theoretical return before fund costs and the selected leverage benchmark return.</p>
    <p>Positive means daily resetting helped compared with the selected reset rule. Negative means volatility decay hurt.</p>
  `,
  "theoretical-before-costs": `
    <h4>Theoretical return before fund costs</h4>
    <p>A synthetic return path: target-index daily return × leverage, minus the estimated cash/financing contribution from SOFR / Fed Funds.</p>
    <p>It includes the cash-rate estimate, but excludes expense ratio, swap/futures basis, transaction costs, tracking error, and taxes.</p>
  `,
  naive: `
    <h4>Configurable leverage benchmark</h4>
    <p>A synthetic benchmark that applies the fund's target leverage and resets it by the selected calendar schedule or leverage band.</p>
    <p>It excludes fund expenses, financing spread, taxes, and transaction costs. If you choose <strong>Never</strong>, it becomes a no-reset leverage formula: <code>1 + leverage × (benchmark − 1)</code>.</p>
  `,
};

const TIPS_ZH = {
  observed: `
    <h4>模型 - ETF 差異</h4>
    <p>所選期間內，理論模型報酬與 ETF 實際報酬之間的年化差異。</p>
    <p>正數代表模型報酬高於 ETF；負數代表 ETF 優於模型。</p>
  `,
  financing: `
    <h4>估算融資影響</h4>
    <p>模型差異中由短期基準利率估算的部分。多頭槓桿 ETF 通常有融資成本；反向 ETF 可能有現金或抵押品收益。</p>
    <p>公式為 <code>(槓桿倍數 − 1) × 利率</code>。美國基金使用 SOFR / Fed Funds；台灣資料未啟用前不以 0050 代替指數。</p>
  `,
  residual: `
    <h4>殘差模型差異</h4>
    <p>模型差異扣除估算融資影響後的年化結果。正數代表 ETF 在扣除融資估算後仍落後模型；負數代表 ETF 優於模型。</p>
    <p>這是差異歸因項，不是費用本身；可能包含經理費、交換或期貨基差、抵押品收益、交易成本、追蹤誤差，以及基準資料基礎差異。</p>
  `,
  paths: `
    <h4>所選期間投入 100 的路徑</h4>
    <p>比較 ETF 實際報酬、基金費用前理論報酬、可設定重設規則的槓桿基準，以及 1 倍標的指數。</p>
  `,
  log: `
    <h4>對數與線性刻度</h4>
    <p>對數刻度會讓相同百分比變動看起來有相同距離，適合查看長期間、數值差距很大的路徑。</p>
    <p>反向槓桿 ETF 長期可能接近零；線性刻度下容易擠在底部，對數刻度能保留變化。</p>
    <p>對數刻度不能顯示零或負數；合成槓桿基準若跌到零或以下，也會從路徑圖省略。</p>
  `,
  "cost-vs-financing": `
    <h4>模型差異與融資影響</h4>
    <p>把滾動年化的「模型 - ETF」差異，與估算融資影響放在同一張圖比較。</p>
    <p>兩條線的差距是殘差模型差異，不是費用線。</p>
    <p>大幅跳動通常是極端交易日進入或離開 365 日窗口，不代表費率平滑改變。</p>
  `,
  "benchmark-model": `
    <h4>可設定槓桿基準</h4>
    <p>這條線是合成槓桿基準，可選擇何時把槓桿重設回目標倍數。</p>
    <p><strong>定期重設</strong>會依週、季、半年或一年等固定頻率重設。<strong>永不</strong>代表所選期間內不重設槓桿。</p>
    <p><strong>槓桿區間</strong>可以和定期重設一起使用；有效槓桿低於下限或高於上限時，會提前重設回目標倍數。</p>
    <p>兩者同時啟用時，區間是提前觸發條件，定期重設是固定檢查點。</p>
  `,
  decomp: `
    <h4>差距來源</h4>
    <p>ETF 實際報酬與所選槓桿基準的差距，可拆成追蹤差距與重設複利 / 衰減。</p>
  `,
  "cumulative-cost": `
    <h4>ETF - 模型差異</h4>
    <p>ETF 實際路徑與基金費用前理論路徑的差距，以百分點表示。</p>
  `,
  compounding: `
    <h4>重設複利 / 衰減</h4>
    <p>基金費用前理論報酬與所選槓桿基準報酬的百分點差距。正數代表每日重設相對有利；負數代表波動衰減不利。</p>
  `,
  "theoretical-before-costs": `
    <h4>基金費用前理論報酬</h4>
    <p>合成路徑：標的指數每日報酬 × 槓桿倍數，再扣除估算的現金 / 融資利率影響。</p>
    <p>包含利率估算，但不包含經理費、交換或期貨基差、交易成本、追蹤誤差與稅務。</p>
  `,
  naive: `
    <h4>可設定槓桿基準</h4>
    <p>依所選定期重設或槓桿區間，把基金目標槓桿套用到標的指數上的合成基準。</p>
    <p>不包含基金費用、融資利差、稅務與交易成本。若選擇「永不」，就等同所選期間內不重設的槓桿公式。</p>
  `,
};

function tipHtml(id) {
  return (state.lang === "zh-Hant" ? TIPS_ZH[id] : null) ?? TIPS[id] ?? `<p>No explanation for "${id}".</p>`;
}

const UI_TEXT = {
  en: {
    brand_title: "Leveraged ETF",
    brand_subtitle: "Tracking & Leverage Analytics",
    lang_label: "Language",
    language_en: "English",
    language_zh: "Chinese",
    loading: "Loading...",
    controls_aria: "View controls",
    range_presets_aria: "Time range presets",
    scale_aria: "Y-axis scale",
    section_comparison: "Comparison",
    control_benchmark_settings: "Leverage benchmark",
    rebalance_period: "Rebalance period",
    rebalance_band: "Rebalance band",
    leverage_cost: "Rate spread",
    benchmark_rate_plus: "Benchmark rate +",
    explain: "Explain",
    explain_paths: "Explain performance paths",
    explain_log: "Explain log scale",
    explain_benchmark_model: "Explain benchmark model",
    benchmark_model_aria: "Benchmark model",
    reset_frequency_aria: "Reset frequency",
    band_to: "to",
    band_lower_placeholder: "Lower band",
    band_upper_placeholder: "Upper band",
    reset_daily: "Daily",
    reset_weekly: "Weekly",
    reset_monthly: "Monthly",
    reset_quarterly: "Quarterly",
    reset_semiannual: "Half-year",
    reset_annual: "Annual",
    reset_none: "Never",
    control_etf: "ETF",
    control_range: "Time range",
    control_dates: "Dates",
    date_start_placeholder: "Start date",
    date_end_placeholder: "End date",
    date_to: "to",
    date_conjunction: " to ",
    range_1m: "1M",
    range_3m: "3M",
    range_6m: "6M",
    range_ytd: "YTD",
    range_1y: "1Y",
    range_3y: "3Y",
    range_5y: "5Y",
    range_10y: "10Y",
    range_max: "Max",
    range_custom: "Custom",
    section_performance: "Performance",
    section_cost: "Tracking vs model",
    updated: "Updated",
    rate: "Rate",
    basis: "Basis",
    basis_etf_index: "ETF adjusted close + index close",
    basis_adjusted_total_return: "adjusted close total return",
    footer_meta_prefix: "yfinance ETF adjusted close + index close",
    footer_meta_via: "via FRED",
    footer_meta_updated: "last updated",
    method_meta_updated: "Data updated",
    trading_days: "trading days",
    inception: "inception",
    chart_actual_etf: "Actual ETF",
    chart_target_index: "Target index (1x)",
    chart_reset_benchmark_prefix: "Leverage benchmark",
    chart_reset_calendar: "{frequency} reset",
    chart_reset_band: "{lower}x-{upper}x leverage band",
    chart_net_tracking_cost: "Model - ETF difference",
    chart_financing: "Estimated financing impact",
    chart_other_tracking: "Residual model difference",
    chart_tracking_gap: "ETF - model difference",
    chart_total_gap: "Total gap (actual - leverage benchmark)",
    comparison_difference: "Benchmark - ETF difference",
    actual_return: "Actual ETF return",
    target_return: "Target index return",
    whole_period_benchmark: "Configurable leverage benchmark",
    daily_reset_decay: "Reset compounding / decay",
    theoretical_before_costs: "Theoretical return before fund costs",
    net_tracking_cost: "Model - ETF difference (ann.)",
    financing_contribution: "Estimated financing impact (ann.)",
    other_fund_costs: "Residual model difference (ann.)",
    cumulative_tracking_gap: "ETF - model difference",
    paths_title: "$100 invested over selected range",
    scale_linear: "Linear",
    scale_log: "Log",
    paths_note: "What $100 would be worth across four scenarios: actual ETF, theoretical return before fund costs, configurable leverage benchmark, and the underlying target index.",
    cost_chart_title: "Model difference vs financing impact",
    cost_chart_note: "Rolling annualized model - ETF difference compared with the estimated financing impact.",
    residual_chart_title: "Residual model difference",
    residual_chart_note: "Rolling annualized difference after removing the estimated financing impact. This is not a fee line.",
    decomp_chart_title: "Where the gap comes from",
    decomp_chart_note: "Tracking gap (actual - theoretical) plus reset compounding / decay equals the total gap.",
    methodology_title: "Methodology",
    method_qa_summary: "Data, rates, and benchmark Q&A",
    method_qa_rate_us_q: "How is the US benchmark rate used?",
    method_qa_rate_us_a: "US funds use SOFR where available, blended with Fed Funds before SOFR history starts. The daily financing contribution is (leverage - 1) x annual benchmark rate x calendar days / 365.",
    method_qa_rate_tw_q: "How is the Taiwan benchmark rate used?",
    method_qa_rate_tw_a: "Taiwan funds use the TWD interbank overnight rate as the benchmark rate with the same financing formula.",
    method_qa_basis_q: "What is the daily leverage benchmark basis?",
    method_qa_basis_a: "The benchmark daily return is calculated from the official target-index close. The daily leveraged target is leverage x that benchmark daily return.",
    method_qa_price_q: "What price is used for the ETF?",
    method_qa_price_a: "US ETFs use adjusted close so distributions and splits are reinvested. 00631L uses TWSE official daily close with the 2026 split adjusted, because Yahoo's adjusted history is not reliable for that split.",
    method_qa_theoretical_q: "What is theoretical return before fund costs?",
    method_qa_theoretical_a: "It compounds the daily leveraged target after the estimated cash-rate contribution, but before expense ratio, swap or futures basis, trading costs, tracking error, and taxes.",
    method_data_summary: "ETF adjusted close and target-index close",
    method_data_p1: "The ETF side is pulled from adjusted close, so ETF distributions and splits are treated as reinvested into the same fund instead of being mis-classified as tracking drag.",
    method_data_p2: "The benchmark side uses the official target index close: Nasdaq-100 Index, S&P 500 Index, and Taiwan 50 Index where available.",
    method_data_p3: "This is still a pre-tax convention. It does not model dividend withholding tax, income tax, reinvestment transaction costs, or investor-level cash drag.",
    method_fluct_summary: "Why the model difference fluctuates",
    method_fluct_p1: "Daily model difference is leveraged target-index close return minus ETF adjusted-close return. The rolling chart annualizes those daily gaps inside a 365-calendar-day window.",
    method_fluct_p2: "The line can jump when an extreme market day enters or leaves the rolling window.",
    method_fluct_p3: "These swings are plausible for leveraged funds because execution timing, NAV calculation, swap/futures basis, market disruption, rebalance cost, and benchmark pricing differences can all be large on volatile days.",
    method_annual_summary: "Annualized model differences",
    method_annual_p1: "Summary tracking cards use the selected date range. Model - ETF difference annualizes the compounded gap between theoretical and actual returns; financing impact is still summed by calendar day.",
    method_annual_p2: "The tracking charts still show rolling 365-calendar-day annualized lines so changes over time remain visible.",
    method_tracking_summary: "Model - ETF difference",
    method_tracking_p1: "Difference between the theoretical return before fund costs and the actual ETF return. Positive means the model return was higher than the ETF; negative means the ETF beat the model.",
    method_decay_summary: "Volatility decay / compounding effect",
    method_decay_p1: "Daily-resetting leverage compounds differently than less frequent reset rules. In strong trends compounding helps; in choppy or mean-reverting markets it hurts. This is not a fee.",
    method_inverse_summary: "Inverse ETFs and log scale",
    method_inverse_p1: "Inverse leveraged ETFs can decay toward zero over long uptrends. The paths chart opens on log scale for inverse funds so the move from 100 to tiny values remains visible.",
    method_inverse_p2: "A synthetic leverage benchmark can go negative if the underlying move is large enough before the next reset; those points are omitted from the path chart because they are not investable account values.",
  },
  "zh-Hant": {
    brand_title: "槓桿 ETF",
    brand_subtitle: "追蹤與槓桿分析",
    lang_label: "語言",
    language_en: "英文",
    language_zh: "中文",
    loading: "載入中...",
    controls_aria: "檢視控制項",
    range_presets_aria: "期間快捷選項",
    scale_aria: "Y 軸刻度",
    section_comparison: "比較",
    control_benchmark_settings: "槓桿基準",
    rebalance_period: "再平衡週期",
    rebalance_band: "再平衡區間",
    leverage_cost: "利率利差",
    benchmark_rate_plus: "基準利率 +",
    explain: "說明",
    explain_paths: "說明績效路徑",
    explain_log: "說明對數刻度",
    explain_benchmark_model: "說明槓桿基準",
    benchmark_model_aria: "槓桿基準模型",
    reset_frequency_aria: "重設頻率",
    band_to: "至",
    band_lower_placeholder: "下限",
    band_upper_placeholder: "上限",
    reset_daily: "每日",
    reset_weekly: "每週",
    reset_monthly: "每月",
    reset_quarterly: "每季",
    reset_semiannual: "每半年",
    reset_annual: "每年",
    reset_none: "永不",
    control_etf: "ETF",
    control_range: "期間",
    control_dates: "日期",
    date_start_placeholder: "開始日期",
    date_end_placeholder: "結束日期",
    date_to: "至",
    date_conjunction: " 至 ",
    range_1m: "1個月",
    range_3m: "3個月",
    range_6m: "6個月",
    range_ytd: "年初至今",
    range_1y: "1年",
    range_3y: "3年",
    range_5y: "5年",
    range_10y: "10年",
    range_max: "最長",
    range_custom: "自訂",
    section_performance: "績效",
    section_cost: "模型追蹤差異",
    updated: "更新",
    rate: "利率",
    basis: "價格基礎",
    basis_etf_index: "ETF 調整收盤價 + 指數收盤價",
    basis_adjusted_total_return: "調整收盤價總報酬",
    footer_meta_prefix: "yfinance ETF 調整收盤價 + 指數收盤價",
    footer_meta_via: "經 FRED",
    footer_meta_updated: "最後更新",
    method_meta_updated: "資料更新",
    trading_days: "個交易日",
    inception: "成立日",
    chart_actual_etf: "ETF 實際路徑",
    chart_target_index: "標的指數（1倍）",
    chart_reset_benchmark_prefix: "槓桿基準",
    chart_reset_calendar: "{frequency}重設",
    chart_reset_band: "{lower}x-{upper}x 槓桿區間",
    chart_net_tracking_cost: "模型 - ETF 差異",
    chart_financing: "估算融資影響",
    chart_other_tracking: "殘差模型差異",
    chart_tracking_gap: "ETF - 模型差異",
    chart_total_gap: "總差距（實際 - 槓桿基準）",
    comparison_difference: "基準 - ETF 差距",
    actual_return: "ETF 實際報酬",
    target_return: "標的指數報酬",
    whole_period_benchmark: "可設定槓桿基準",
    daily_reset_decay: "重設複利 / 衰減",
    theoretical_before_costs: "基金費用前理論報酬",
    net_tracking_cost: "模型 - ETF 差異（年化）",
    financing_contribution: "估算融資影響（年化）",
    other_fund_costs: "殘差模型差異（年化）",
    cumulative_tracking_gap: "ETF - 模型差異",
    paths_title: "所選期間投入 100",
    scale_linear: "線性",
    scale_log: "對數",
    paths_note: "比較 100 元在四種路徑下的結果：ETF 實際報酬、基金費用前理論報酬、可設定槓桿基準，以及 1 倍標的指數。",
    cost_chart_title: "模型差異與融資影響",
    cost_chart_note: "滾動年化的模型 - ETF 差異，與估算融資影響的比較。",
    residual_chart_title: "殘差模型差異",
    residual_chart_note: "扣除估算融資影響後的滾動年化差異。這不是費用線。",
    decomp_chart_title: "差距來源",
    decomp_chart_note: "追蹤差距（實際 - 理論）加上重設複利 / 衰減，等於總差距。",
    methodology_title: "方法說明",
    method_qa_summary: "資料、利率與基準問答",
    method_qa_rate_us_q: "美國基準利率如何使用？",
    method_qa_rate_us_a: "美國基金在可取得時使用 SOFR，SOFR 歷史開始前以 Fed Funds 補足。每日融資貢獻 = (槓桿倍數 - 1) x 年化基準利率 x 日曆日數 / 365。",
    method_qa_rate_tw_q: "台灣基準利率如何使用？",
    method_qa_rate_tw_a: "台灣基金使用新臺幣金融業隔夜拆款利率作為基準利率，並套用相同的融資公式。",
    method_qa_basis_q: "每日槓桿基準如何計算？",
    method_qa_basis_a: "先用官方標的指數收盤價計算每日報酬，再用槓桿倍數乘上該每日報酬。",
    method_qa_price_q: "ETF 價格使用什麼口徑？",
    method_qa_price_a: "美國 ETF 使用調整收盤價，讓配息與拆合股視為再投資。00631L 使用 TWSE 官方每日收盤價，並調整 2026 年分割，因為 Yahoo 的調整歷史對該次分割不可靠。",
    method_qa_theoretical_q: "基金費用前理論報酬是什麼？",
    method_qa_theoretical_a: "它把每日槓桿目標扣除估算的現金利率影響後逐日複利，但不包含經理費、交換或期貨基差、交易成本、追蹤誤差與稅務。",
    method_data_summary: "ETF 調整收盤價與標的指數收盤價",
    method_data_p1: "ETF 使用調整收盤價，因此配息與拆合股視為再投資於同一基金，避免被誤判為追蹤拖累。",
    method_data_p2: "基準使用官方標的指數收盤價：Nasdaq-100、S&P 500，以及可取得時的 Taiwan 50 Index。",
    method_data_p3: "這仍是稅前口徑，未納入股息扣繳稅、所得稅、再投資交易成本或投資人的現金拖累。",
    method_fluct_summary: "為何模型差異會波動",
    method_fluct_p1: "每日模型差異為槓桿倍數乘以標的指數收盤報酬，再減去 ETF 調整收盤報酬。圖表以 365 個日曆日滾動年化。",
    method_fluct_p2: "當極端交易日進入或離開滾動窗口時，線圖可能明顯跳動。",
    method_fluct_p3: "對槓桿基金而言，執行時點、NAV 計算、交換或期貨基差、市場波動、再平衡成本與基準定價差異都可能造成波動。",
    method_annual_summary: "年化模型差異",
    method_annual_p1: "摘要追蹤卡使用所選日期區間。模型 - ETF 差異以理論報酬與實際報酬的複利差距年化；融資影響仍按日曆日加總。",
    method_annual_p2: "追蹤圖表仍顯示 365 個日曆日滾動年化線，以便觀察時間變化。",
    method_tracking_summary: "模型 - ETF 差異",
    method_tracking_p1: "基金費用前理論報酬與 ETF 實際報酬的差異。正數代表模型報酬高於 ETF；負數代表 ETF 優於模型。",
    method_decay_summary: "波動衰減 / 複利效果",
    method_decay_p1: "每日重設槓桿與較低頻率的重設規則不同。趨勢明確時複利可能有利；震盪或均值回歸時可能不利。這不是費用。",
    method_inverse_summary: "反向 ETF 與對數刻度",
    method_inverse_p1: "反向槓桿 ETF 在長期上升市場可能趨近於零。反向基金預設使用對數刻度，讓從 100 跌到很小數值的路徑仍可閱讀。",
    method_inverse_p2: "若下一次重設前標的變動過大，合成槓桿基準可能跌到零或以下；這些點不是可投資帳戶價值，圖表會省略。",
  },
};

function t(key) {
  const lang = state.lang || "en";
  return UI_TEXT[lang]?.[key] ?? UI_TEXT.en[key] ?? key;
}

function rangeLabel(rangeKey) {
  return t(`range_${rangeKey}`);
}

function rollingLabel(key, days) {
  return state.lang === "zh-Hant" ? `${t(key)}（${days}日年化）` : `${t(key)} (${days}d ann.)`;
}

function rateSourceLabel(rateSource) {
  if (!rateSource) return "—";
  const normalized = rateSource.replace("_BLENDED", "");
  const labels = {
    en: {
      SOFR_BLENDED: "SOFR / Fed Funds (blended)",
      SOFR: "SOFR",
      TWD_INTERBANK_OVERNIGHT: "TWD interbank overnight",
    },
    "zh-Hant": {
      SOFR_BLENDED: "SOFR / Fed Funds 混合",
      SOFR: "SOFR",
      TWD_INTERBANK_OVERNIGHT: "新臺幣金融業隔夜拆款利率",
    },
  };
  return labels[state.lang]?.[rateSource] ?? labels.en[rateSource] ?? normalized.replace(/_/g, " ");
}

function dataBasisLabel(dataBasis) {
  return {
    etf_adjusted_close_index_close: t("basis_etf_index"),
    adjusted_close_total_return: t("basis_adjusted_total_return"),
  }[dataBasis] ?? (dataBasis ?? "").replace(/_/g, " ");
}

function regionLabel(regionName, regionKey) {
  if (state.lang !== "zh-Hant") return regionName ?? regionKey ?? "Other";
  return {
    "Nasdaq-100": "那斯達克 100",
    "S&P 500": "標普 500",
    "Taiwan 50": "台灣 50",
    "Global Equity": "全球股票",
    "Single Stock": "單一股票",
    us_nasdaq100: "那斯達克 100",
    us_sp500: "標普 500",
    taiwan_50: "台灣 50",
    global_equity: "全球股票",
    single_stock: "單一股票",
  }[regionName] ?? {
    us_nasdaq100: "那斯達克 100",
    us_sp500: "標普 500",
    taiwan_50: "台灣 50",
    global_equity: "全球股票",
    single_stock: "單一股票",
  }[regionKey] ?? regionName ?? regionKey ?? "其他";
}

function benchmarkLabel(benchmarkName, benchmarkTicker) {
  if (state.lang !== "zh-Hant") return benchmarkName ?? benchmarkTicker;
  return {
    "^NDX": "那斯達克 100 指數",
    "^GSPC": "標普 500 指數",
    "^TW50": "臺灣 50 指數",
    "VT": "Vanguard 全球股票 ETF",
    "TSLA": "Tesla",
  }[benchmarkTicker] ?? benchmarkName ?? benchmarkTicker;
}

function resetFrequencyLabel(freq) {
  return t(`reset_${freq}`);
}

function selectedLeverageBenchmarkLabel() {
  const freq = resetFrequencyLabel(state.resetFrequency);
  const rule = t("chart_reset_calendar").replace("{frequency}", freq);
  const bandBounds = validBandBounds();
  if (!bandBounds) return `${t("chart_reset_benchmark_prefix")} - ${rule}`;
  const band = t("chart_reset_band")
    .replace("{lower}", fmtNum(bandBounds.lower, 1))
    .replace("{upper}", fmtNum(bandBounds.upper, 1));
  return `${t("chart_reset_benchmark_prefix")} - ${rule} + ${band}`;
}

const charts = {};
const state = {
  config: null,
  summary: null,
  ticker: null,
  lang: "en",
  rangePreset: "max",
  dateFrom: null, // null → use first row (since inception)
  dateTo: null,   // null → use last row
  series: null,
  paths_scale: "linear",
  userSelectedScale: false,
  resetFrequency: "none",
  bandLower: null,
  bandUpper: null,
  leverageCostSpread: 0,
};
let fpStart = null;
let fpEnd = null;

/* ------------------------------------------------------------------
 *  Formatters
 * ------------------------------------------------------------------ */
function fmtPct(v, digits = 2) {
  if (v == null || Number.isNaN(v)) return "—";
  return (v * 100).toFixed(digits) + "%";
}
function fmtNum(v, digits = 3) {
  if (v == null || Number.isNaN(v)) return "—";
  return v.toFixed(digits);
}
function fmtMoney(v) {
  if (v == null || Number.isNaN(v)) return "—";
  const sign = v < 0 ? "-" : "";
  const abs = Math.abs(v);
  const symbol = state.series?.metadata?.currency_symbol ?? "$";
  if (abs >= 1_000_000) return `${sign}${symbol}${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 10_000) return `${sign}${symbol}${Math.round(abs).toLocaleString()}`;
  if (abs >= 100) return `${sign}${symbol}${abs.toFixed(0)}`;
  if (abs >= 1) return `${sign}${symbol}${abs.toFixed(2)}`;
  return `${sign}${symbol}${abs.toFixed(4)}`;
}
function fmtMoneyDelta(v) {
  if (v == null || Number.isNaN(v)) return "—";
  const sign = v >= 0 ? "+" : "−";
  return sign + fmtMoney(Math.abs(v)).replace("-", "");
}
function fmtPerHundred(deltaMultiple) {
  if (deltaMultiple == null || Number.isNaN(deltaMultiple)) return "—";
  return fmtMoneyDelta(deltaMultiple * BASE_VALUE);
}
function fmtBigPct(pct, { signed = false } = {}) {
  if (pct == null || Number.isNaN(pct)) return "—";
  const abs = Math.abs(pct);
  const body = abs >= 100 ? Math.round(abs).toLocaleString() : abs.toFixed(2);
  if (signed) {
    const sign = pct >= 0 ? "+" : "−";
    return `${sign}${body}%`;
  }
  return (pct < 0 ? "−" : "") + body + "%";
}
function fmtTotalReturn(multiple) {
  if (multiple == null || Number.isNaN(multiple)) return "—";
  return fmtBigPct((multiple - 1) * 100, { signed: true });
}
function fmtDeltaPct(deltaMultiple) {
  if (deltaMultiple == null || Number.isNaN(deltaMultiple)) return "—";
  return fmtBigPct(deltaMultiple * 100, { signed: true });
}

async function fetchJSON(path) {
  const r = await fetch(path, { cache: "no-cache" });
  if (!r.ok) throw new Error(`${path}: ${r.status}`);
  return r.json();
}

function dateToMs(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

function msToDate(ms) {
  return new Date(ms).toISOString().slice(0, 10);
}

function addCalendarDays(dateStr, days) {
  return msToDate(dateToMs(dateStr) + days * MS_PER_DAY);
}

function startOfYear(dateStr) {
  return `${dateStr.slice(0, 4)}-01-01`;
}

function clampDate(dateStr, minDate, maxDate) {
  if (!dateStr) return null;
  if (dateStr < minDate) return minDate;
  if (dateStr > maxDate) return maxDate;
  return dateStr;
}

function showError(msg) {
  const div = document.createElement("div");
  div.className = "error";
  div.textContent = msg;
  document.body.appendChild(div);
}

function getChart(id) {
  if (!charts[id]) {
    charts[id] = echarts.init(document.getElementById(id), null, { renderer: "canvas" });
    window.addEventListener("resize", () => charts[id].resize());
  }
  return charts[id];
}

/* ------------------------------------------------------------------
 *  Chart base option
 * ------------------------------------------------------------------ */
function baseLineOption() {
  return {
    backgroundColor: "transparent",
    grid: { left: 64, right: 18, top: 36, bottom: 56, containLabel: false },
    legend: {
      top: 4,
      textStyle: { color: COLOR.text, fontSize: 12, fontFamily: "Inter, system-ui, sans-serif" },
      itemGap: 18,
      icon: "roundRect",
      itemWidth: 12,
      itemHeight: 8,
    },
    tooltip: {
      trigger: "axis",
      backgroundColor: COLOR.tooltipBg,
      borderColor: COLOR.axis,
      textStyle: { color: COLOR.text, fontFamily: "JetBrains Mono, monospace", fontSize: 12 },
      axisPointer: { type: "line", lineStyle: { color: COLOR.muted, type: "dashed" } },
    },
    xAxis: {
      type: "time",
      axisLine: { lineStyle: { color: COLOR.axis } },
      axisLabel: { color: COLOR.muted, fontSize: 11 },
      splitLine: { show: false },
    },
    yAxis: {
      type: "value",
      axisLine: { show: false },
      axisLabel: { color: COLOR.muted, fontSize: 11 },
      splitLine: { lineStyle: { color: COLOR.grid, type: "dashed" } },
    },
    dataZoom: [
      { type: "inside", throttle: 50 },
      {
        type: "slider",
        bottom: 6,
        height: 16,
        backgroundColor: "transparent",
        borderColor: COLOR.axis,
        fillerColor: "rgba(91, 157, 255, 0.10)",
        handleStyle: { color: COLOR.actual, borderColor: COLOR.actual },
        moveHandleStyle: { color: COLOR.actual },
        textStyle: { color: COLOR.muted, fontSize: 10 },
        dataBackground: {
          lineStyle: { color: "rgba(133,147,166,0.4)", width: 1 },
          areaStyle: { color: "rgba(133,147,166,0.12)" },
        },
        selectedDataBackground: {
          lineStyle: { color: COLOR.actual, width: 1 },
          areaStyle: { color: "rgba(91,157,255,0.18)" },
        },
      },
    ],
    series: [],
  };
}

function pctYAxis(opt, digits = 1) {
  opt.yAxis.axisLabel = {
    color: COLOR.muted,
    fontSize: 11,
    formatter: (v) => (v * 100).toFixed(digits) + "%",
  };
  opt.tooltip.valueFormatter = (v) => fmtPct(v, 2);
  return opt;
}
function moneyYAxis(opt) {
  opt.yAxis.axisLabel = {
    color: COLOR.muted,
    fontSize: 11,
    formatter: (v) => fmtMoney(v),
  };
  opt.tooltip.valueFormatter = (v) => fmtMoney(v);
  return opt;
}

function lineSeries(name, color, data, { dashed = false, width = 2, area = false } = {}) {
  const series = {
    name,
    type: "line",
    showSymbol: false,
    sampling: "lttb",
    smooth: false,
    connectNulls: false,
    lineStyle: { width, color, type: dashed ? "dashed" : "solid" },
    itemStyle: { color },
    data,
  };
  if (area) series.areaStyle = { color: hexToRgba(color, 0.12) };
  return series;
}

function hexToRgba(hex, alpha) {
  const m = hex.replace("#", "");
  const r = parseInt(m.substring(0, 2), 16);
  const g = parseInt(m.substring(2, 4), 16);
  const b = parseInt(m.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

/* ------------------------------------------------------------------
 *  Calendar-day rolling window (two-pointer, O(N))
 *  Σ cost over trailing >= windowCalendarDays of calendar time,
 *  then annualize: × 365 / Σ calendar_days.
 * ------------------------------------------------------------------ */
function rollingAnnualizedCost(rows, windowCalendarDays, costKey) {
  const out = new Array(rows.length);
  let left = 0;
  let sumCost = 0;
  let sumDays = 0;
  for (let right = 0; right < rows.length; right++) {
    const r = rows[right];
    if (r[costKey] != null && r.calendar_days_elapsed != null) {
      sumCost += r[costKey];
      sumDays += r.calendar_days_elapsed;
    }
    while (left < right) {
      const oldD = rows[left].calendar_days_elapsed ?? 0;
      const oldC = rows[left][costKey] ?? 0;
      if (sumDays - oldD < windowCalendarDays) break;
      sumCost -= oldC;
      sumDays -= oldD;
      left++;
    }
    out[right] =
      sumDays >= windowCalendarDays
        ? [r.date, (sumCost * 365) / sumDays]
        : [r.date, null];
  }
  return out;
}

function selectedPeriodAnnualizedCost(rows, costKey) {
  let sumCost = 0;
  let sumDays = 0;
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (r[costKey] == null || r.calendar_days_elapsed == null) continue;
    sumCost += r[costKey];
    sumDays += r.calendar_days_elapsed;
  }
  return sumDays > 0 ? (sumCost * 365) / sumDays : null;
}

function selectedPeriodCalendarDays(rows) {
  let sumDays = 0;
  for (let i = 1; i < rows.length; i++) {
    const days = rows[i].calendar_days_elapsed;
    if (days != null) sumDays += days;
  }
  if (sumDays > 0) return sumDays;
  const first = rows[0]?.date;
  const last = rows[rows.length - 1]?.date;
  return first && last ? Math.max(1, (dateToMs(last) - dateToMs(first)) / MS_PER_DAY) : null;
}

function annualizedReturn(multiple, days) {
  if (multiple == null || days == null || days <= 0 || !(multiple > 0)) return null;
  return Math.pow(multiple, 365 / days) - 1;
}

function lastValid(arr) {
  for (let i = arr.length - 1; i >= 0; i--) {
    if (arr[i][1] != null) return arr[i][1];
  }
  return null;
}

/* ------------------------------------------------------------------
 *  Header / subtitle
 * ------------------------------------------------------------------ */
function setHeaderMeta() {
  const m = state.summary?.metadata ?? {};
  const rateLabel = rateSourceLabel(m.rate_source);
  const basisLabel = dataBasisLabel(m.data_basis);
  document.getElementById("header-meta").innerHTML = `
    <div class="meta-item">${t("updated")} <strong>${m.last_updated ?? "—"}</strong></div>
  `;
  const methodMeta = document.getElementById("methodology-meta");
  if (methodMeta) {
    methodMeta.innerHTML = `
      <div class="meta-item">${t("method_meta_updated")} <strong>${m.last_updated ?? "—"}</strong></div>
      <div class="meta-item">${t("rate")} <strong>${rateLabel || "—"}</strong></div>
      <div class="meta-item">${t("basis")} <strong>${basisLabel}</strong></div>
    `;
  }
  document.getElementById("footer-meta").textContent =
    `${t("footer_meta_prefix")} · ${rateLabel} ${t("footer_meta_via")} · ${t("footer_meta_updated")} ${m.last_updated ?? ""}`;
}

function setSubtitle() {
  const m = state.series.metadata;
  const lev = m.leverage > 0 ? `+${m.leverage}×` : `${m.leverage}×`;
  const benchmark = benchmarkLabel(m.benchmark_name, m.benchmark);
  const ticker = m.display_ticker ?? m.ticker;
  document.getElementById("subtitle").textContent =
    `${ticker} · ${lev} ${benchmark} · ${m.currency ?? ""} · ${t("inception")} ${m.inception} · ${m.rows.toLocaleString()} ${t("trading_days")}`;
}

function populateTickerSelect() {
  const sel = document.getElementById("ticker-select");
  const previous = state.ticker;
  sel.innerHTML = "";
  const groups = new Map();
  for (const e of state.config.etfs) {
    const key = regionLabel(e.region_name, e.region);
    if (!groups.has(key)) {
      const group = document.createElement("optgroup");
      group.label = `${key}${e.currency ? ` · ${e.currency}` : ""}`;
      groups.set(key, group);
      sel.appendChild(group);
    }
    const lev = e.leverage > 0 ? `+${e.leverage}×` : `${e.leverage}×`;
    const benchmark = benchmarkLabel(e.benchmark_name, e.benchmark);
    const ticker = e.display_ticker ?? e.ticker;
    const opt = document.createElement("option");
    opt.value = e.ticker;
    opt.textContent = `${ticker}  ·  ${lev} ${benchmark}`;
    groups.get(key).appendChild(opt);
  }
  const hasPrevious = previous && Array.from(sel.options).some((opt) => opt.value === previous);
  sel.value = hasPrevious ? previous : state.config.etfs[0].ticker;
  state.ticker = sel.value;
}

/* ------------------------------------------------------------------
 *  Cards (rebased to $100)
 * ------------------------------------------------------------------ */
function renderCards(rows) {
  const first = rows[0];
  const last = rows[rows.length - 1];
  if (!last) return;

  const financing = selectedPeriodAnnualizedCost(rows, "financing_cost_calendar");
  const selected = selectedPathMultiples(first, last);
  const theoreticalBeforeCosts = selectedTheoreticalBeforeCostsMultiple(rows);
  const selectedDays = selectedPeriodCalendarDays(rows);
  const actualAnn = annualizedReturn(selected.actual, selectedDays);
  const theoreticalAnn = annualizedReturn(theoreticalBeforeCosts, selectedDays);
  const observed = actualAnn == null || theoreticalAnn == null ? null : theoreticalAnn - actualAnn;
  const residual = observed == null || financing == null ? null : observed - financing;
  const leverageBenchmark = selectedLeverageBenchmarkMultiple(rows);
  const selectedCompounding = leverageBenchmark == null ? null : theoreticalBeforeCosts - leverageBenchmark;

  const valueCards = [
    { label: t("actual_return"),              v: fmtTotalReturn(selected.actual),    tone: signTone(selected.actual - 1, true) },
    { label: t("target_return"),              v: fmtTotalReturn(selected.benchmark), tone: signTone(selected.benchmark - 1, true) },
  ];

  const benchmarkDiff = leverageBenchmark == null ? null : leverageBenchmark - selected.actual;
  const comparisonCards = [
    { tip: "naive", label: t("whole_period_benchmark"), v: fmtTotalReturn(leverageBenchmark), tone: signTone(leverageBenchmark - 1, true) },
    { label: t("comparison_difference"), v: fmtDeltaPct(benchmarkDiff), tone: signTone(benchmarkDiff, true) },
  ];

  const costCards = [
    { tip: "theoretical-before-costs", label: t("theoretical_before_costs"), v: fmtTotalReturn(theoreticalBeforeCosts), tone: signTone(theoreticalBeforeCosts - 1, true) },
    { tip: "observed",  label: t("net_tracking_cost"),   v: fmtPct(observed, 2),  tone: signTone(observed, false) },
    { tip: "financing", label: t("financing_contribution"), v: fmtPct(financing, 2) },
    { tip: "residual",  label: t("other_fund_costs"),              v: fmtPct(residual, 2),  tone: signTone(residual, false) },
    { tip: "cumulative-cost", label: t("cumulative_tracking_gap"), v: fmtDeltaPct(selected.actual - theoreticalBeforeCosts), tone: signTone(selected.actual - theoreticalBeforeCosts, true) },
  ];

  const renderCard = (c) => `
      <div class="card ${c.tone ?? ""}">
        <div class="label">
          ${c.label}
          ${c.tip ? `<button type="button" class="info-btn" data-tip="${c.tip}" aria-label="${t("explain")}">?</button>` : ""}
        </div>
        <div class="value">${c.v}</div>
      </div>`;

  document.getElementById("summary-cards-values").innerHTML = valueCards.map(renderCard).join("");
  document.getElementById("summary-cards-comparison").innerHTML = comparisonCards.map(renderCard).join("");
  document.getElementById("summary-cards-costs").innerHTML = costCards.map(renderCard).join("");
}

function signTone(v, positiveIsGood) {
  if (v == null || Number.isNaN(v) || v === 0) return "";
  const positive = v > 0;
  const good = positiveIsGood ? positive : !positive;
  return good ? "pos" : "neg";
}

/* ------------------------------------------------------------------
 *  Charts
 * ------------------------------------------------------------------ */
function pickRange(rows) {
  const { from, to } = resolveRangeBounds(rows);
  const selected = rows.filter((r) => r.date >= from && r.date <= to);
  return selected.length ? selected : rows.slice(-1);
}

function resolveRangeBounds(rows) {
  const first = rows[0]?.date;
  const last = rows[rows.length - 1]?.date;
  if (!first || !last) return { from: null, to: null };

  if (state.rangePreset === "custom" && (state.dateFrom || state.dateTo)) {
    const from = clampDate(state.dateFrom || first, first, last);
    const to = clampDate(state.dateTo || last, first, last);
    return from <= to ? { from, to } : { from: to, to: from };
  }

  const preset = RANGE_PRESETS[state.rangePreset] ?? RANGE_PRESETS.max;
  if (preset.max) return { from: first, to: last };
  if (preset.ytd) return { from: clampDate(startOfYear(last), first, last), to: last };
  return { from: clampDate(addCalendarDays(last, -preset.days), first, last), to: last };
}

function buildSeries(rows, key) {
  return rows.map((r) => [r.date, r[key]]);
}

function selectedPathMultiples(first, row) {
  const actual = row.actual_etf_path / first.actual_etf_path;
  const perfect = row.perfect_leveraged_path / first.perfect_leveraged_path;
  const benchmark = row.benchmark_path / first.benchmark_path;
  return { actual, perfect, benchmark };
}

function selectedTheoreticalBeforeCostsMultiple(rows) {
  let v = 1;
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const dailyLeveraged = r.ideal_daily_leveraged_return ?? 0;
    const financing = r.financing_cost_calendar ?? 0;
    v *= 1 + dailyLeveraged - financing;
  }
  return v;
}

function buildTheoreticalBeforeCostsSeries(rows, { positiveOnly = false } = {}) {
  let v = BASE_VALUE;
  return rows.map((r, i) => {
    if (i > 0) {
      const dailyLeveraged = r.ideal_daily_leveraged_return ?? 0;
      const financing = r.financing_cost_calendar ?? 0;
      v *= 1 + dailyLeveraged - financing;
    }
    if (positiveOnly && !(v > 0)) return [r.date, null];
    return [r.date, v];
  });
}

function periodKey(dateStr, frequency) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  if (frequency === "daily") return dateStr;
  if (frequency === "weekly") {
    const day = (d.getUTCDay() + 6) % 7;
    const monday = Date.UTC(y, m, d.getUTCDate() - day);
    return Math.floor(monday / (7 * MS_PER_DAY));
  }
  if (frequency === "monthly") return `${y}-${m}`;
  if (frequency === "quarterly") return `${y}-Q${Math.floor(m / 3)}`;
  if (frequency === "semiannual") return `${y}-H${Math.floor(m / 6)}`;
  if (frequency === "annual") return `${y}`;
  return "none";
}

function shouldCalendarReset(prevDate, date) {
  const freq = state.resetFrequency;
  return freq !== "none" && periodKey(prevDate, freq) !== periodKey(date, freq);
}

function validBandBounds() {
  const lower = Number(state.bandLower);
  const upper = Number(state.bandUpper);
  return Number.isFinite(lower) && Number.isFinite(upper) && lower > 0 && upper > lower
    ? { lower, upper }
    : null;
}

function buildLeverageBenchmarkSeries(rows, { positiveOnly = false } = {}) {
  if (!rows.length) return [];
  const leverage = state.series.metadata.leverage;
  let value = BASE_VALUE;
  let exposure = leverage * value;
  let alive = true;
  const band = validBandBounds();
  const spread = (Number(state.leverageCostSpread) || 0) / 100;

  return rows.map((r, i) => {
    if (i === 0) return [r.date, BASE_VALUE];
    if (!alive) return [r.date, null];

    const prev = rows[i - 1];
    if (shouldCalendarReset(prev.date, r.date)) {
      exposure = leverage * value;
    }

    const benchmarkReturn = r.benchmark_return ?? (r.benchmark_path / prev.benchmark_path - 1);
    const days = r.calendar_days_elapsed ?? 1;
    const rate = (r.annual_rate ?? 0) + spread;
    const financing = (leverage - 1) * rate * days / 365;
    const pnl = exposure * benchmarkReturn;
    value += pnl - value * financing;
    exposure += pnl;
    const effectiveLeverage = value !== 0 ? exposure / value : Infinity;

    if (!(value > 0)) {
      alive = false;
      return [r.date, null];
    }

    const point = positiveOnly && !(value > 0) ? [r.date, null] : [r.date, value];

    if (band) {
      const absLev = Math.abs(effectiveLeverage);
      if (absLev < band.lower || absLev > band.upper) {
        exposure = leverage * value;
      }
    }
    return point;
  });
}

function selectedLeverageBenchmarkMultiple(rows) {
  const series = buildLeverageBenchmarkSeries(rows);
  const last = lastValid(series);
  return last == null ? null : last / BASE_VALUE;
}

function buildSelectedPathSeries(rows, key, { positiveOnly = false } = {}) {
  const first = rows[0];
  return rows.map((r) => {
    const v = selectedPathMultiples(first, r)[key] * BASE_VALUE;
    if (v == null || Number.isNaN(v)) return [r.date, null];
    if (positiveOnly && !(v > 0)) return [r.date, null];
    return [r.date, v];
  });
}

function buildScaledSeries(rows, key, scale, { positiveOnly = false } = {}) {
  return rows.map((r) => {
    const raw = r[key];
    if (raw == null || Number.isNaN(raw)) return [r.date, null];
    const v = raw * scale;
    if (positiveOnly && !(v > 0)) return [r.date, null];
    return [r.date, v];
  });
}

function positivePathAxisMin(rows, keys) {
  let min = Infinity;
  const first = rows[0];
  let theoretical = 1;
  const leverageBenchmark = buildLeverageBenchmarkSeries(rows);
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (r !== rows[0]) {
      theoretical *= 1 + (r.ideal_daily_leveraged_return ?? 0) - (r.financing_cost_calendar ?? 0);
    }
    const selected = selectedPathMultiples(first, r);
    for (const key of keys) {
      const v = key === "theoretical"
        ? theoretical * BASE_VALUE
        : key === "leverageBenchmark"
          ? leverageBenchmark[i]?.[1]
          : selected[key] * BASE_VALUE;
      if (v > 0 && v < min) min = v;
    }
  }
  if (!Number.isFinite(min)) return 0.01;
  return Math.pow(10, Math.floor(Math.log10(min)));
}

function renderPaths(rows) {
  const isLog = state.paths_scale === "log";
  const isInverse = (state.series?.metadata?.leverage ?? 0) < 0;
  const opt = baseLineOption();

  if (isLog) {
    opt.yAxis = {
      type: "log",
      logBase: 10,
      axisLine: { show: false },
      axisLabel: { color: COLOR.muted, fontSize: 11, formatter: (v) => fmtMoney(v) },
      splitLine: { lineStyle: { color: COLOR.grid, type: "dashed" } },
      min: positivePathAxisMin(rows, ["actual", "theoretical", "benchmark", "leverageBenchmark"]),
    };
    opt.tooltip.valueFormatter = (v) => fmtMoney(v);
  } else {
    moneyYAxis(opt);
    opt.yAxis.min = 0;
  }

  const positiveOnly = isLog;
  opt.series = [
    lineSeries(t("chart_actual_etf"), COLOR.actual, buildSelectedPathSeries(rows, "actual", { positiveOnly }), { width: 2 }),
    lineSeries(t("theoretical_before_costs"), COLOR.perfect, buildTheoreticalBeforeCostsSeries(rows, { positiveOnly }), { width: 2 }),
    lineSeries(selectedLeverageBenchmarkLabel(), COLOR.naive, buildLeverageBenchmarkSeries(rows, { positiveOnly: isLog || isInverse }), { width: 1.6, dashed: true }),
    lineSeries(t("chart_target_index"), COLOR.benchmark, buildSelectedPathSeries(rows, "benchmark", { positiveOnly }), { width: 1.4 }),
  ];
  getChart("chart-paths").setOption(opt, true);
}

function filterPairsToRows(pairs, rows) {
  const from = rows[0]?.date;
  const to = rows[rows.length - 1]?.date;
  return pairs.filter(([date]) => date >= from && date <= to);
}

function renderCost(rows, fullRows) {
  const w = ROLLING_COST_DAYS;
  const opt = pctYAxis(baseLineOption());
  opt.series = [
    lineSeries(rollingLabel("chart_net_tracking_cost", w), COLOR.observed, filterPairsToRows(rollingAnnualizedCost(fullRows, w, "observed_implied_cost"), rows), { width: 2 }),
    lineSeries(rollingLabel("chart_financing", w), COLOR.financing, filterPairsToRows(rollingAnnualizedCost(fullRows, w, "financing_cost_calendar"), rows), { width: 2, dashed: true }),
  ];
  getChart("chart-cost").setOption(opt, true);
}

function renderResidual(rows, fullRows) {
  const w = ROLLING_COST_DAYS;
  const opt = pctYAxis(baseLineOption());
  opt.series = [
    lineSeries(rollingLabel("chart_other_tracking", w), COLOR.residual, filterPairsToRows(rollingAnnualizedCost(fullRows, w, "residual_cost_calendar"), rows), { width: 2, area: true }),
  ];
  getChart("chart-residual").setOption(opt, true);
}

function renderDecomp(rows) {
  const first = rows[0];
  const opt = moneyYAxis(baseLineOption());
  const leverageBenchmarkSeries = buildLeverageBenchmarkSeries(rows);
  const selectedGapSeries = (name) => {
    let theoretical = 1;
    return rows.map((r, i) => {
      if (i > 0) {
        theoretical *= 1 + (r.ideal_daily_leveraged_return ?? 0) - (r.financing_cost_calendar ?? 0);
      }
      const selected = selectedPathMultiples(first, r);
      const leverageBenchmark = leverageBenchmarkSeries[i]?.[1] == null ? null : leverageBenchmarkSeries[i][1] / BASE_VALUE;
      if (leverageBenchmark == null) return [r.date, null];
      const v = {
        tracking: selected.actual - theoretical,
        compounding: theoretical - leverageBenchmark,
        total: selected.actual - leverageBenchmark,
      }[name] * BASE_VALUE;
      return [r.date, v];
    });
  };
  opt.series = [
    lineSeries(t("chart_tracking_gap"), COLOR.trackingDrag, selectedGapSeries("tracking"), { width: 2 }),
    lineSeries(t("daily_reset_decay"), COLOR.compounding, selectedGapSeries("compounding"), { width: 2 }),
    lineSeries(t("chart_total_gap"), COLOR.decay, selectedGapSeries("total"), { width: 1.4, dashed: true }),
  ];
  getChart("chart-decomp").setOption(opt, true);
}

/* ------------------------------------------------------------------
 *  Info popover
 * ------------------------------------------------------------------ */
function positionPopover(targetEl, popoverEl) {
  popoverEl.classList.remove("hidden");
  const margin = 8;
  const rect = targetEl.getBoundingClientRect();
  const pw = popoverEl.offsetWidth;
  const ph = popoverEl.offsetHeight;
  let left = rect.left;
  if (left + pw + margin > window.innerWidth) {
    left = Math.max(margin, window.innerWidth - pw - margin);
  }
  let top = rect.bottom + margin + window.scrollY;
  if (rect.bottom + ph + margin > window.innerHeight) {
    top = Math.max(margin, rect.top + window.scrollY - ph - margin);
  }
  popoverEl.style.left = `${left}px`;
  popoverEl.style.top = `${top}px`;
}

function setupInfoPopovers() {
  const pop = document.getElementById("info-popover");
  let activeBtn = null;

  document.addEventListener("click", (e) => {
    const btn = e.target.closest(".info-btn");
    if (btn) {
      e.stopPropagation();
      const id = btn.dataset.tip;
      if (activeBtn === btn) {
        pop.classList.add("hidden");
        activeBtn = null;
        return;
      }
      pop.innerHTML = tipHtml(id);
      pop.classList.remove("hidden");
      // measure after content insertion
      requestAnimationFrame(() => positionPopover(btn, pop));
      activeBtn = btn;
    } else if (!e.target.closest(".info-popover")) {
      pop.classList.add("hidden");
      activeBtn = null;
    }
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      pop.classList.add("hidden");
      activeBtn = null;
    }
  });
  window.addEventListener("scroll", () => {
    if (activeBtn && !pop.classList.contains("hidden")) {
      positionPopover(activeBtn, pop);
    }
  }, { passive: true });
  window.addEventListener("resize", () => {
    if (activeBtn && !pop.classList.contains("hidden")) {
      positionPopover(activeBtn, pop);
    }
  });
}

/* ------------------------------------------------------------------
 *  Orchestration
 * ------------------------------------------------------------------ */
function renderAll() {
  if (!state.series) return;
  setSubtitle();
  const fullRows = state.series.rows;
  const rows = pickRange(fullRows);
  updateRangeControls();
  renderCards(rows);
  renderPaths(rows);
  renderCost(rows, fullRows);
  renderResidual(rows, fullRows);
  renderDecomp(rows);
}

async function loadTicker(ticker) {
  state.ticker = ticker;
  state.series = await fetchJSON(`${DATA_BASE}/tickers/${ticker}.json`);
  updateBenchmarkModelControls();
  syncDatePickerBounds();
  if (!state.userSelectedScale) {
    setPathScale(state.series.metadata.leverage < 0 ? "log" : "linear", { render: false });
  }
  renderAll();
}

function syncDatePickerBounds() {
  if (!state.series?.rows?.length) return;
  const rows = state.series.rows;
  const first = rows[0].date;
  const last = rows[rows.length - 1].date;
  if (fpStart) { fpStart.set("minDate", first); fpStart.set("maxDate", last); }
  if (fpEnd) { fpEnd.set("minDate", first); fpEnd.set("maxDate", last); }
}

function setupDatePickers() {
  if (typeof flatpickr !== "function") return;
  const applyCustomRange = () => {
    if (!state.series?.rows?.length) return;
    const rows = state.series.rows;
    const fmt = (d) => fpStart.formatDate(d, "Y-m-d");
    state.rangePreset = "custom";
    state.dateFrom = fpStart?.selectedDates?.[0] ? fmt(fpStart.selectedDates[0]) : rows[0].date;
    state.dateTo = fpEnd?.selectedDates?.[0] ? fmt(fpEnd.selectedDates[0]) : rows[rows.length - 1].date;
    renderAll();
  };
  fpStart = flatpickr("#date-start", {
    dateFormat: "Y-m-d",
    allowInput: false,
    disableMobile: true,
    onChange: applyCustomRange,
  });
  fpEnd = flatpickr("#date-end", {
    dateFormat: "Y-m-d",
    allowInput: false,
    disableMobile: true,
    onChange: applyCustomRange,
  });
}

function updateRangePresetLabels() {
  document.querySelectorAll("#range-presets button[data-range]").forEach((button) => {
    button.textContent = rangeLabel(button.dataset.range);
  });
}

function updateBenchmarkModelControls() {
  const reset = document.getElementById("reset-frequency");
  const lower = document.getElementById("band-lower");
  const upper = document.getElementById("band-upper");
  const cost = document.getElementById("leverage-cost-spread");
  if (!reset || !lower || !upper || !cost) return;

  reset.value = state.resetFrequency;
  for (const freq of RESET_FREQUENCIES) {
    const opt = reset.querySelector(`option[value="${freq}"]`);
    if (opt) opt.textContent = resetFrequencyLabel(freq);
  }

  if (document.activeElement !== lower) lower.value = state.bandLower == null ? "" : fmtNum(Number(state.bandLower), 1);
  if (document.activeElement !== upper) upper.value = state.bandUpper == null ? "" : fmtNum(Number(state.bandUpper), 1);
  if (document.activeElement !== cost) cost.value = fmtNum(Number(state.leverageCostSpread) || 0, 1);
}

function updateRangeControls() {
  if (!state.series?.rows?.length) return;
  document
    .querySelectorAll("#range-presets button[data-range]")
    .forEach((b) => b.classList.toggle("active", b.dataset.range === state.rangePreset));

  const { from, to } = resolveRangeBounds(state.series.rows);
  if (fpStart && from) fpStart.setDate(from, false);
  if (fpEnd && to) fpEnd.setDate(to, false);
}

function setupRangePresets() {
  const presets = document.getElementById("range-presets");
  presets.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-range]");
    if (!btn) return;
    if (btn.dataset.range === "custom") {
      state.rangePreset = "custom";
      updateRangeControls();
      if (fpStart) fpStart.open();
      return;
    }
    state.rangePreset = btn.dataset.range;
    state.dateFrom = null;
    state.dateTo = null;
    renderAll();
  });
}

function setupBenchmarkModelControls() {
  const reset = document.getElementById("reset-frequency");
  const lower = document.getElementById("band-lower");
  const upper = document.getElementById("band-upper");
  const cost = document.getElementById("leverage-cost-spread");

  reset.addEventListener("change", (e) => {
    state.resetFrequency = RESET_FREQUENCIES.includes(e.target.value) ? e.target.value : "quarterly";
    updateBenchmarkModelControls();
    if (state.series) renderAll();
  });

  const applyBand = () => {
    const nextLower = Number(lower.value);
    const nextUpper = Number(upper.value);
    state.bandLower = lower.value.trim() === "" || !Number.isFinite(nextLower) ? null : nextLower;
    state.bandUpper = upper.value.trim() === "" || !Number.isFinite(nextUpper) ? null : nextUpper;
    updateBenchmarkModelControls();
    if (state.series) renderAll();
  };
  lower.addEventListener("input", applyBand);
  upper.addEventListener("input", applyBand);

  cost.addEventListener("input", () => {
    const next = Number(cost.value);
    state.leverageCostSpread = Number.isFinite(next) ? next : 0;
    if (state.series) renderAll();
  });
}

function applyLanguage() {
  document.documentElement.lang = state.lang === "zh-Hant" ? "zh-Hant" : "en";
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    el.textContent = t(el.dataset.i18n);
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
    el.setAttribute("placeholder", t(el.dataset.i18nPlaceholder));
  });
  document.querySelectorAll("[data-i18n-aria]").forEach((el) => {
    el.setAttribute("aria-label", t(el.dataset.i18nAria));
  });
  const langSelect = document.getElementById("language-select");
  langSelect.querySelector('option[value="en"]').textContent = t("language_en");
  langSelect.querySelector('option[value="zh-Hant"]').textContent = t("language_zh");
  updateRangePresetLabels();
  updateBenchmarkModelControls();
  if (state.config) populateTickerSelect();
  if (fpStart || fpEnd) updateRangeControls();
  setHeaderMeta();
  if (state.series) renderAll();
}

function setupLanguageSelect() {
  const sel = document.getElementById("language-select");
  sel.addEventListener("change", (e) => {
    state.lang = e.target.value;
    applyLanguage();
  });
}

function setPathScale(scale, { render = true, user = false } = {}) {
  state.paths_scale = scale;
  if (user) state.userSelectedScale = true;
  document
    .querySelectorAll("#scale-toggle button[data-scale]")
    .forEach((b) => b.classList.toggle("active", b.dataset.scale === scale));
  if (render && state.series) {
    const rows = pickRange(state.series.rows);
    renderPaths(rows);
  }
}

function setupScaleToggle() {
  const toggle = document.getElementById("scale-toggle");
  toggle.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-scale]");
    if (!btn) return;
    const scale = btn.dataset.scale;
    if (scale === state.paths_scale) return;
    setPathScale(scale, { user: true });
  });
}

async function init() {
  try {
    setupInfoPopovers();
    setupScaleToggle();
    setupDatePickers();
    setupRangePresets();
    setupBenchmarkModelControls();
    setupLanguageSelect();

    const [config, summary] = await Promise.all([
      fetchJSON(`${DATA_BASE}/config.json`),
      fetchJSON(`${DATA_BASE}/summary.json`),
    ]);
    state.config = config;
    state.summary = summary;

    applyLanguage();
    populateTickerSelect();
    await loadTicker(state.ticker);

    document
      .getElementById("ticker-select")
      .addEventListener("change", (e) => loadTicker(e.target.value));
  } catch (err) {
    console.error(err);
    showError(
      `Failed to load data: ${err.message}\n\n` +
        `Serve the public/ directory over HTTP (file:// blocks fetch). For example:\n` +
        `  python3 -m http.server 8000 --directory public\n` +
        `then open http://localhost:8000/`
    );
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
