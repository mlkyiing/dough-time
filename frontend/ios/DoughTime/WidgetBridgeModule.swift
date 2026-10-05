import Foundation
import WidgetKit
import React

@objc(WidgetBridgeModule)
class WidgetBridgeModule: NSObject {

  @objc
  static func requiresMainQueueSetup() -> Bool {
    return false
  }

  @objc
  func setWidgetData(
    _ jsonString: String,
    suiteName: String,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    // 1. Write to App Group UserDefaults
    if let sharedDefaults = UserDefaults(suiteName: suiteName) {
      sharedDefaults.set(jsonString, forKey: "widgetData")
      sharedDefaults.synchronize()
    }

    // 2. Also write to App Group shared file container for dual reliability
    if let containerURL = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: suiteName) {
      let fileURL = containerURL.appendingPathComponent("widgetData.json")
      try? jsonString.write(to: fileURL, atomically: true, encoding: .utf8)
    }

    if #available(iOS 14.0, *) {
      WidgetCenter.shared.reloadAllTimelines()
    }

    resolve(true)
  }

  @objc
  func reloadTimelines(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    if #available(iOS 14.0, *) {
      WidgetCenter.shared.reloadAllTimelines()
    }
    resolve(true)
  }
}
