#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(WidgetBridgeModule, NSObject)

RCT_EXTERN_METHOD(setWidgetData:(NSString *)jsonString
                  suiteName:(NSString *)suiteName
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(reloadTimelines:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

@end
