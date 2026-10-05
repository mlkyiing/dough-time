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
    if let sharedDefaults = UserDefaults(suiteName: suiteName) {
      sharedDefaults.set(jsonString, forKey: "widgetData")
      sharedDefaults.synchronize()
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
