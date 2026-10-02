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
    let appGroupSuite = "group.com.doughtime.app"

    func placeholder(in context: Context) -> WidgetBudgetEntry {
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

    func getSnapshot(in context: Context, completion: @escaping (WidgetBudgetEntry) -> Void) {
        completion(loadSharedEntry())
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<WidgetBudgetEntry>) -> Void) {
        let entry = loadSharedEntry()
        // Refresh every 30 minutes or when triggered by app via WidgetCenter.shared.reloadAllTimelines()
        let nextUpdate = Calendar.current.date(byAdding: .minute, value: 30, to: Date()) ?? Date()
        let timeline = Timeline(entries: [entry], policy: .after(nextUpdate))
        completion(timeline)
    }

    private func loadSharedEntry() -> WidgetBudgetEntry {
        guard let sharedDefaults = UserDefaults(suiteName: appGroupSuite),
              let jsonString = sharedDefaults.string(forKey: "widgetData"),
              let data = jsonString.data(using: .utf8) else {
            return placeholder(in: Context(isPreview: true))
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

        return placeholder(in: Context(isPreview: true))
    }
}

// MARK: - Widget View (Supports Lock Screen & Home Screen)
struct DoughTimeWidgetEntryView: View {
    var entry: DoughTimeTimelineProvider.Entry
    @Environment(\.widgetFamily) var family

    var body: some View {
        switch family {
        // MARK: 1. Lock Screen Rectangular
        case .accessoryRectangular:
            VStack(alignment: .leading, spacing: 1) {
                HStack(spacing: 4) {
                    Text("🍞")
                        .font(.system(size: 11))
                    Text("DOUGHTIME")
                        .font(.system(size: 10, weight: .bold))
                    Spacer()
                    Text("\(max(0, 100 - entry.budgetUsedPct))% left")
                        .font(.system(size: 10, weight: .semibold))
                }
                Text("\(entry.currency) \(String(format: "%.2f", entry.availableToSpend))")
                    .font(.system(size: 16, weight: .heavy))
                    .minimumScaleFactor(0.8)
                Text("Available · ~\(String(format: "%.0f", entry.availableHours))h life energy")
                    .font(.system(size: 9))
                    .foregroundColor(.secondary)
            }

        // MARK: 2. Lock Screen Circular Gauge
        case .accessoryCircular:
            Gauge(value: Double(max(0, 100 - entry.budgetUsedPct)), in: 0...100) {
                Text("Left")
                    .font(.system(size: 8, weight: .bold))
            } currentValueLabel: {
                Text("\(max(0, 100 - entry.budgetUsedPct))%")
                    .font(.system(size: 12, weight: .heavy))
            }
            .gaugeStyle(.accessoryCircular)

        // MARK: 3. Lock Screen Inline (Above Clock)
        case .accessoryInline:
            Text("🍞 Available: \(entry.currency) \(String(format: "%.2f", entry.availableToSpend))")
                .font(.system(size: 11, weight: .semibold))

        // MARK: 4. Home Screen Small
        case .systemSmall:
            VStack(alignment: .leading, spacing: 6) {
                HStack {
                    Text("🍞")
                        .font(.system(size: 20))
                    Spacer()
                    Text("\(max(0, 100 - entry.budgetUsedPct))% left")
                        .font(.system(size: 11, weight: .bold))
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(Color.pink.opacity(0.15))
                        .cornerRadius(8)
                }
                Spacer()
                Text("AVAILABLE TO SPEND")
                    .font(.system(size: 9, weight: .bold))
                    .foregroundColor(.secondary)
                Text("\(entry.currency) \(String(format: "%.2f", entry.availableToSpend))")
                    .font(.system(size: 20, weight: .heavy))
                Text("Comfort pot: \(entry.currency) \(String(format: "%.0f", entry.comfortRemaining))")
                    .font(.system(size: 10))
                    .foregroundColor(.secondary)
            }
            .padding()

        default:
            Text("DoughTime: \(entry.currency) \(String(format: "%.2f", entry.availableToSpend))")
        }
    }
}

// MARK: - Main Widget Declaration
@main
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
    }
}
