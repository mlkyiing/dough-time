import WidgetKit
import SwiftUI

// MARK: - Widget Shared Data Model
struct WidgetBudgetEntry: TimelineEntry {
    let date: Date
    let availableToSpend: Double
    let comfortRemaining: Double
    let budgetLimit: Double
    let budgetUsedPct: Int
    let currency: String
    let availableHours: Double
}

// MARK: - Timeline Provider
struct DoughTimeTimelineProvider: TimelineProvider {
    let appGroupSuite = "group.com.michelleloh.doughtime"

    private var fallbackEntry: WidgetBudgetEntry {
        WidgetBudgetEntry(
            date: Date(),
            availableToSpend: 420.50,
            comfortRemaining: 150.00,
            budgetLimit: 2000.00,
            budgetUsedPct: 65,
            currency: "RM",
            availableHours: 16.2
        )
    }

    func placeholder(in context: Context) -> WidgetBudgetEntry {
        fallbackEntry
    }

    func getSnapshot(in context: Context, completion: @escaping (WidgetBudgetEntry) -> Void) {
        completion(loadSharedEntry())
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<WidgetBudgetEntry>) -> Void) {
        let entry = loadSharedEntry()
        let nextUpdate = Calendar.current.date(byAdding: .minute, value: 30, to: Date()) ?? Date()
        let timeline = Timeline(entries: [entry], policy: .after(nextUpdate))
        completion(timeline)
    }

    private func loadSharedEntry() -> WidgetBudgetEntry {
        guard let sharedDefaults = UserDefaults(suiteName: appGroupSuite),
              let jsonString = sharedDefaults.string(forKey: "widgetData"),
              let data = jsonString.data(using: .utf8) else {
            return fallbackEntry
        }

        do {
            if let dict = try JSONSerialization.jsonObject(with: data) as? [String: Any] {
                let available = dict["availableToSpend"] as? Double ?? 0.0
                let comfort = dict["comfortRemaining"] as? Double ?? 0.0
                let limit = dict["budgetLimit"] as? Double ?? 2000.0
                let pct = dict["budgetUsedPct"] as? Int ?? 0
                let curr = dict["currency"] as? String ?? "RM"
                let hrs = dict["availableHours"] as? Double ?? 0.0

                return WidgetBudgetEntry(
                    date: Date(),
                    availableToSpend: available,
                    comfortRemaining: comfort,
                    budgetLimit: limit,
                    budgetUsedPct: pct,
                    currency: curr,
                    availableHours: hrs
                )
            }
        } catch {
            print("Failed to decode widget payload: \(error)")
        }

        return fallbackEntry
    }
}

// MARK: - iOS 17+ Background Compatibility Helper
extension View {
    @ViewBuilder
    func widgetBackground(_ color: Color = .clear) -> some View {
        if #available(iOS 17.0, iOSApplicationExtension 17.0, *) {
            self.containerBackground(for: .widget) {
                color
            }
        } else {
            self.background(color)
        }
    }
}

// MARK: - Widget View (Supports Lock Screen & Home Screen)
struct DoughTimeWidgetEntryView: View {
    var entry: DoughTimeTimelineProvider.Entry
    @Environment(\.widgetFamily) var family

    private var leftPct: Int {
        max(0, 100 - entry.budgetUsedPct)
    }

    private var cuteMood: String {
        if leftPct >= 60 {
            return "🥟 Happy Dough"
        } else if leftPct >= 30 {
            return "🥟 DoughTime"
        } else if leftPct >= 10 {
            return "🥟 Chill Mode"
        } else {
            return "🥟 Saving Mode"
        }
    }

    private var cuteFace: String {
        if leftPct >= 60 {
            return "(◕‿◕)✨"
        } else if leftPct >= 30 {
            return "(｡•̀ᴗ-)✧"
        } else if leftPct >= 10 {
            return "(´･ω･`)"
        } else {
            return "(；•̀_•́)"
        }
    }

    private var cuteSubtitle: String {
        let hours = String(format: "%.0f", entry.availableHours)
        if leftPct >= 50 {
            return "💖 ~\(hours)h life freedom"
        } else if leftPct >= 20 {
            return "✨ ~\(hours)h safe spend"
        } else {
            return "🌱 ~\(hours)h comfort left"
        }
    }

    var body: some View {
        switch family {
        // 1. Lock Screen Rectangular Card
        case .accessoryRectangular:
            VStack(alignment: .leading, spacing: 1) {
                HStack(spacing: 3) {
                    Text(cuteMood)
                        .font(.system(size: 10.5, weight: .bold, design: .rounded))
                    Spacer()
                    Text("\(leftPct)% left ✨")
                        .font(.system(size: 10, weight: .bold, design: .rounded))
                }
                Text("\(entry.currency) \(String(format: "%.2f", entry.availableToSpend))")
                    .font(.system(size: 18, weight: .heavy, design: .rounded))
                    .minimumScaleFactor(0.8)
                HStack(spacing: 4) {
                    Text(cuteSubtitle)
                        .font(.system(size: 9.5, weight: .medium, design: .rounded))
                        .foregroundColor(.secondary)
                    Spacer()
                    Text(cuteFace)
                        .font(.system(size: 8.5, weight: .bold, design: .rounded))
                        .foregroundColor(.secondary)
                }
            }
            .widgetBackground()

        // 2. Lock Screen Circular Gauge
        case .accessoryCircular:
            ZStack {
                AccessoryWidgetBackground()
                VStack(spacing: 0) {
                    Text("🥟")
                        .font(.system(size: 13))
                    Text("\(leftPct)%")
                        .font(.system(size: 11.5, weight: .heavy, design: .rounded))
                    Text("safe ✨")
                        .font(.system(size: 7.5, weight: .bold, design: .rounded))
                        .foregroundColor(.secondary)
                }
            }
            .widgetBackground()

        // 3. Lock Screen Inline (Above Clock)
        case .accessoryInline:
            Text("🥟 \(entry.currency) \(String(format: "%.0f", entry.availableToSpend)) · \(leftPct)% left \(cuteFace)")
                .font(.system(size: 11, weight: .semibold, design: .rounded))

        // 4. Home Screen Small
        case .systemSmall:
            VStack(alignment: .leading, spacing: 6) {
                HStack {
                    Text("🥟")
                        .font(.system(size: 24))
                    Spacer()
                    Text("\(leftPct)% safe ✨")
                        .font(.system(size: 11, weight: .heavy, design: .rounded))
                        .padding(.horizontal, 7)
                        .padding(.vertical, 3)
                        .background(Color.pink.opacity(0.18))
                        .foregroundColor(.pink)
                        .cornerRadius(10)
                }
                Spacer()
                Text("AVAILABLE TO SPEND")
                    .font(.system(size: 9, weight: .bold, design: .rounded))
                    .foregroundColor(.secondary)
                Text("\(entry.currency) \(String(format: "%.2f", entry.availableToSpend))")
                    .font(.system(size: 21, weight: .heavy, design: .rounded))
                Text(cuteSubtitle + " " + cuteFace)
                    .font(.system(size: 9.5, weight: .medium, design: .rounded))
                    .foregroundColor(.secondary)
            }
            .padding(14)
            .widgetBackground(Color(.systemBackground))

        default:
            Text("🥟 \(entry.currency) \(String(format: "%.2f", entry.availableToSpend))")
                .widgetBackground()
        }
    }
}

// MARK: - Main Widget Declaration
struct DoughTimeWidget: Widget {
    let kind: String = "DoughTimeLockScreenWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: DoughTimeTimelineProvider()) { entry in
            DoughTimeWidgetEntryView(entry: entry)
        }
        .configurationDisplayName("DoughTime Budget")
        .description("Track your live available spending money directly on your Lock Screen.")
        .supportedFamilies([
            .accessoryRectangular,
            .accessoryCircular,
            .accessoryInline,
            .systemSmall
        ])
        .contentMarginsDisabled()
    }
}
