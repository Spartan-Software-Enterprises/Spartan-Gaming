#include <node_api.h>
#include <Carbon/Carbon.h>
#include <CoreGraphics/CoreGraphics.h>
#include <CoreHaptics/CoreHaptics.h>
#include <GameController/GameController.h>
#include <IOKit/hid/IOHIDLib.h>
#include <dispatch/dispatch.h>

#include <algorithm>
#include <cmath>
#include <cstdint>
#include <cstdlib>
#include <string>

// Xcode 26 omits the legacy user-device declarations from the public SDK.
// Keep the optional path isolated behind the stable IOKit symbols; creation
// failure remains a normal unavailable capability.
typedef struct __IOHIDUserDevice* IOHIDUserDeviceRef;
extern "C" IOHIDUserDeviceRef IOHIDUserDeviceCreate(CFAllocatorRef allocator, CFDictionaryRef properties);
extern "C" IOReturn IOHIDUserDeviceHandleReport(IOHIDUserDeviceRef device, uint8_t* report, CFIndex report_length);
extern "C" void IOHIDUserDeviceScheduleWithRunLoop(IOHIDUserDeviceRef device, CFRunLoopRef run_loop, CFStringRef mode);
extern "C" void IOHIDUserDeviceUnscheduleFromRunLoop(IOHIDUserDeviceRef device, CFRunLoopRef run_loop, CFStringRef mode);

namespace {

IOHIDUserDeviceRef virtual_device = nullptr;
uint8_t virtual_report[6] = {0, 0, 128, 128, 128, 128};
const uint8_t virtual_report_descriptor[] = {
  0x05, 0x01, 0x09, 0x05, 0xA1, 0x01, 0x15, 0x00, 0x25, 0x01,
  0x75, 0x01, 0x95, 0x10, 0x05, 0x09, 0x19, 0x01, 0x29, 0x10,
  0x81, 0x02, 0x05, 0x01, 0x15, 0x00, 0x26, 0xFF, 0x00, 0x75,
  0x08, 0x95, 0x04, 0x09, 0x30, 0x09, 0x31, 0x09, 0x32, 0x09,
  0x35, 0x81, 0x02, 0xC0,
};

napi_value fail(napi_env env, const char* message) {
  napi_throw_error(env, nullptr, message);
  return nullptr;
}

napi_value unsupported(napi_env env, const char* message) {
  napi_throw_error(env, "ERR_UNSUPPORTED_INPUT", message);
  return nullptr;
}

bool property(napi_env env, napi_value object, const char* name, napi_value* value) {
  bool has = false;
  if (napi_has_named_property(env, object, name, &has) != napi_ok || !has) return false;
  return napi_get_named_property(env, object, name, value) == napi_ok;
}

std::string string_property(napi_env env, napi_value object, const char* name) {
  napi_value value;
  if (!property(env, object, name, &value)) return {};
  size_t length = 0;
  napi_get_value_string_utf8(env, value, nullptr, 0, &length);
  std::string result(length + 1, '\0');
  napi_get_value_string_utf8(env, value, result.data(), length + 1, &length);
  result.resize(length);
  return result;
}

bool bool_property(napi_env env, napi_value object, const char* name, bool fallback) {
  napi_value value;
  if (!property(env, object, name, &value)) return fallback;
  bool result = fallback;
  napi_get_value_bool(env, value, &result);
  return result;
}

double number_property(napi_env env, napi_value object, const char* name, double fallback) {
  napi_value value;
  if (!property(env, object, name, &value)) return fallback;
  double result = fallback;
  napi_get_value_double(env, value, &result);
  return result;
}

double haptic_magnitude(napi_env env, napi_value object, const char* name, double fallback) {
  return std::max(0.0, std::min(1.0, number_property(env, object, name, fallback)));
}

CGKeyCode key_code(const std::string& control) {
  if (control == "KeyA") return kVK_ANSI_A; if (control == "KeyB") return kVK_ANSI_B; if (control == "KeyC") return kVK_ANSI_C; if (control == "KeyD") return kVK_ANSI_D; if (control == "KeyE") return kVK_ANSI_E; if (control == "KeyF") return kVK_ANSI_F; if (control == "KeyG") return kVK_ANSI_G; if (control == "KeyH") return kVK_ANSI_H; if (control == "KeyI") return kVK_ANSI_I; if (control == "KeyJ") return kVK_ANSI_J; if (control == "KeyK") return kVK_ANSI_K; if (control == "KeyL") return kVK_ANSI_L; if (control == "KeyM") return kVK_ANSI_M; if (control == "KeyN") return kVK_ANSI_N; if (control == "KeyO") return kVK_ANSI_O; if (control == "KeyP") return kVK_ANSI_P; if (control == "KeyQ") return kVK_ANSI_Q; if (control == "KeyR") return kVK_ANSI_R; if (control == "KeyS") return kVK_ANSI_S; if (control == "KeyT") return kVK_ANSI_T; if (control == "KeyU") return kVK_ANSI_U; if (control == "KeyV") return kVK_ANSI_V; if (control == "KeyW") return kVK_ANSI_W; if (control == "KeyX") return kVK_ANSI_X; if (control == "KeyY") return kVK_ANSI_Y; if (control == "KeyZ") return kVK_ANSI_Z;
  if (control == "Digit0") return kVK_ANSI_0; if (control == "Digit1") return kVK_ANSI_1; if (control == "Digit2") return kVK_ANSI_2; if (control == "Digit3") return kVK_ANSI_3; if (control == "Digit4") return kVK_ANSI_4; if (control == "Digit5") return kVK_ANSI_5; if (control == "Digit6") return kVK_ANSI_6; if (control == "Digit7") return kVK_ANSI_7; if (control == "Digit8") return kVK_ANSI_8; if (control == "Digit9") return kVK_ANSI_9;
  if (control == "Space") return kVK_Space; if (control == "Enter") return kVK_Return; if (control == "Escape") return kVK_Escape; if (control == "Tab") return kVK_Tab; if (control == "Backspace") return kVK_Delete; if (control == "Delete") return kVK_ForwardDelete; if (control == "Comma") return kVK_ANSI_Comma; if (control == "Period") return kVK_ANSI_Period; if (control == "Semicolon") return kVK_ANSI_Semicolon; if (control == "Quote") return kVK_ANSI_Quote; if (control == "Backquote") return kVK_ANSI_Grave; if (control == "Slash") return kVK_ANSI_Slash;   if (control == "Backslash") return kVK_ANSI_Backslash; if (control == "IntlBackslash") return kVK_ISO_Section; if (control == "IntlYen") return kVK_JIS_Yen; if (control == "Minus") return kVK_ANSI_Minus; if (control == "Equal") return kVK_ANSI_Equal; if (control == "BracketLeft") return kVK_ANSI_LeftBracket; if (control == "BracketRight") return kVK_ANSI_RightBracket; if (control == "ArrowUp") return kVK_UpArrow; if (control == "ArrowDown") return kVK_DownArrow; if (control == "ArrowLeft") return kVK_LeftArrow; if (control == "ArrowRight") return kVK_RightArrow;
  if (control == "ControlLeft") return kVK_Control; if (control == "ControlRight") return kVK_RightControl; if (control == "ShiftLeft") return kVK_Shift; if (control == "ShiftRight") return kVK_RightShift;
  if (control == "AltLeft") return kVK_Option; if (control == "AltRight") return kVK_RightOption; if (control == "MetaLeft") return kVK_Command; if (control == "MetaRight") return kVK_RightCommand;
  if (control == "CapsLock") return kVK_CapsLock; if (control == "Home") return kVK_Home; if (control == "End") return kVK_End; if (control == "PageUp") return kVK_PageUp; if (control == "PageDown") return kVK_PageDown; if (control == "Insert") return kVK_Help;
  if (control == "F1") return kVK_F1; if (control == "F2") return kVK_F2; if (control == "F3") return kVK_F3; if (control == "F4") return kVK_F4; if (control == "F5") return kVK_F5; if (control == "F6") return kVK_F6;
  if (control == "F7") return kVK_F7; if (control == "F8") return kVK_F8; if (control == "F9") return kVK_F9; if (control == "F10") return kVK_F10; if (control == "F11") return kVK_F11; if (control == "F12") return kVK_F12;
  if (control == "F13") return kVK_F13; if (control == "F14") return kVK_F14; if (control == "F15") return kVK_F15; if (control == "F16") return kVK_F16; if (control == "F17") return kVK_F17; if (control == "F18") return kVK_F18; if (control == "F19") return kVK_F19; if (control == "F20") return kVK_F20;
  if (control == "NumLock") return kVK_ANSI_KeypadClear;
  if (control == "Numpad0") return kVK_ANSI_Keypad0; if (control == "Numpad1") return kVK_ANSI_Keypad1; if (control == "Numpad2") return kVK_ANSI_Keypad2; if (control == "Numpad3") return kVK_ANSI_Keypad3;
  if (control == "Numpad4") return kVK_ANSI_Keypad4; if (control == "Numpad5") return kVK_ANSI_Keypad5; if (control == "Numpad6") return kVK_ANSI_Keypad6; if (control == "Numpad7") return kVK_ANSI_Keypad7;
  if (control == "Numpad8") return kVK_ANSI_Keypad8; if (control == "Numpad9") return kVK_ANSI_Keypad9;
  if (control == "NumpadDecimal") return kVK_ANSI_KeypadDecimal;
  if (control == "NumpadAdd") return kVK_ANSI_KeypadPlus;
  if (control == "NumpadSubtract") return kVK_ANSI_KeypadMinus;
  if (control == "NumpadMultiply") return kVK_ANSI_KeypadMultiply;
  if (control == "NumpadDivide") return kVK_ANSI_KeypadDivide;
  if (control == "NumpadEnter") return kVK_ANSI_KeypadEnter;
  return UINT16_MAX;
}

CGMouseButton mouse_button(const std::string& control) {
  if (control == "button-0") return kCGMouseButtonLeft;
  if (control == "button-1") return kCGMouseButtonCenter;
  if (control == "button-2") return kCGMouseButtonRight;
  return static_cast<CGMouseButton>(UINT8_MAX);
}

int virtual_button_index(const std::string& control) {
  if (control.rfind("button-", 0) == 0) {
    char* end = nullptr; const long index = std::strtol(control.c_str() + 7, &end, 10);
    return end != control.c_str() + 7 && *end == '\0' && index >= 0 && index < 16 ? static_cast<int>(index) : -1;
  }
  const char* aliases[] = {"a", "b", "x", "y", "lb", "rb", "lt", "rt", "back", "start", "l3", "r3", "dpad-up", "dpad-down", "dpad-left", "dpad-right"};
  for (int index = 0; index < 16; index += 1) if (control == aliases[index]) return index;
  return -1;
}

int virtual_axis_index(const std::string& control) {
  if (control.rfind("axis-", 0) != 0) return -1;
  char* end = nullptr; const long index = std::strtol(control.c_str() + 5, &end, 10);
  return end != control.c_str() + 5 && *end == '\0' && index >= 0 && index < 4 ? static_cast<int>(index) : -1;
}

bool send_virtual_report() {
  return virtual_device && IOHIDUserDeviceHandleReport(virtual_device, virtual_report, sizeof(virtual_report)) == kIOReturnSuccess;
}

void close_virtual_gamepad() {
  if (!virtual_device) return;
  IOHIDUserDeviceUnscheduleFromRunLoop(virtual_device, CFRunLoopGetCurrent(), kCFRunLoopDefaultMode);
  CFRelease(virtual_device); virtual_device = nullptr;
}

bool create_virtual_gamepad() {
  CFMutableDictionaryRef properties = CFDictionaryCreateMutable(kCFAllocatorDefault, 0, &kCFTypeDictionaryKeyCallBacks, &kCFTypeDictionaryValueCallBacks);
  if (!properties) return false;
  CFDataRef descriptor = CFDataCreate(kCFAllocatorDefault, virtual_report_descriptor, sizeof(virtual_report_descriptor));
  int32_t vendor = 0x5350; int32_t product = 0x0001; int32_t usage_page = 0x01; int32_t usage = 0x05;
  CFNumberRef vendor_value = CFNumberCreate(kCFAllocatorDefault, kCFNumberSInt32Type, &vendor);
  CFNumberRef product_value = CFNumberCreate(kCFAllocatorDefault, kCFNumberSInt32Type, &product);
  CFNumberRef usage_page_value = CFNumberCreate(kCFAllocatorDefault, kCFNumberSInt32Type, &usage_page);
  CFNumberRef usage_value = CFNumberCreate(kCFAllocatorDefault, kCFNumberSInt32Type, &usage);
  if (!descriptor || !vendor_value || !product_value || !usage_page_value || !usage_value) {
    if (descriptor) CFRelease(descriptor); if (vendor_value) CFRelease(vendor_value); if (product_value) CFRelease(product_value); if (usage_page_value) CFRelease(usage_page_value); if (usage_value) CFRelease(usage_value); CFRelease(properties); return false;
  }
  CFDictionarySetValue(properties, kIOHIDReportDescriptorKey, descriptor);
  CFDictionarySetValue(properties, kIOHIDVendorIDKey, vendor_value);
  CFDictionarySetValue(properties, kIOHIDProductIDKey, product_value);
  CFDictionarySetValue(properties, kIOHIDPrimaryUsagePageKey, usage_page_value);
  CFDictionarySetValue(properties, kIOHIDPrimaryUsageKey, usage_value);
  CFDictionarySetValue(properties, kIOHIDManufacturerKey, CFSTR("Spartan Gaming"));
  CFDictionarySetValue(properties, kIOHIDProductKey, CFSTR("Spartan Virtual Gamepad"));
  virtual_device = IOHIDUserDeviceCreate(kCFAllocatorDefault, properties);
  CFRelease(descriptor); CFRelease(vendor_value); CFRelease(product_value); CFRelease(usage_page_value); CFRelease(usage_value); CFRelease(properties);
  if (!virtual_device) return false;
  IOHIDUserDeviceScheduleWithRunLoop(virtual_device, CFRunLoopGetCurrent(), kCFRunLoopDefaultMode);
  if (!send_virtual_report()) { close_virtual_gamepad(); return false; }
  return true;
}

napi_value execute(napi_env env, napi_callback_info info) {
  napi_value argv[1]; size_t argc = 1;
  if (napi_get_cb_info(env, info, &argc, argv, nullptr, nullptr) != napi_ok || argc < 1) return fail(env, "input operation is required");
  const std::string kind = string_property(env, argv[0], "kind");
  if (kind == "button" || kind == "axis") {
    if (!virtual_device) return unsupported(env, "macOS virtual HID gamepad is unavailable; grant the required device entitlement");
    if (kind == "button") {
      const int index = virtual_button_index(string_property(env, argv[0], "control"));
      if (index < 0) return unsupported(env, "unsupported macOS virtual-gamepad button");
      if (bool_property(env, argv[0], "pressed", false)) virtual_report[index / 8] |= static_cast<uint8_t>(1u << (index % 8));
      else virtual_report[index / 8] &= static_cast<uint8_t>(~(1u << (index % 8)));
    } else {
      const int index = virtual_axis_index(string_property(env, argv[0], "control"));
      if (index < 0) return unsupported(env, "unsupported macOS virtual-gamepad axis");
      const double value = std::max(-1.0, std::min(1.0, number_property(env, argv[0], "value", 0)));
      virtual_report[2 + index] = static_cast<uint8_t>((value + 1.0) * 127.5);
    }
    if (!send_virtual_report()) return fail(env, "macOS could not publish the virtual HID gamepad report");
  } else if (kind == "rumble") {
    const double requested_index = number_property(env, argv[0], "gamepadIndex", 0);
    if (requested_index < 0 || requested_index > 15 || requested_index != std::floor(requested_index)) return fail(env, "macOS GameController indexes must be integers between 0 and 15");
    NSArray<GCController *> *controllers = [GCController controllers];
    const NSUInteger index = static_cast<NSUInteger>(requested_index);
    if (index >= controllers.count) return fail(env, "macOS haptic controller is unavailable");
    GCController *controller = controllers[index];
    GCDeviceHaptics *device_haptics = controller.haptics;
    if (!device_haptics) return fail(env, "macOS controller does not expose haptics");
    CHHapticEngine *engine = [device_haptics createEngineWithLocality:GCHapticsLocalityDefault];
    if (!engine) return fail(env, "macOS controller haptic engine is unavailable");
    NSError *error = nil;
    if (![engine startAndReturnError:&error]) return fail(env, "macOS could not start the controller haptic engine");
    const double duration = std::max(0.01, std::min(5.0, number_property(env, argv[0], "durationMs", 0) / 1000.0));
    const double delay = std::max(0.0, std::min(5.0, number_property(env, argv[0], "startDelay", 0) / 1000.0));
    const double strong = haptic_magnitude(env, argv[0], "strongMagnitude", number_property(env, argv[0], "value", 0));
    const double weak = haptic_magnitude(env, argv[0], "weakMagnitude", number_property(env, argv[0], "value", 0));
    CHHapticEventParameter *intensity = [[CHHapticEventParameter alloc] initWithParameterID:CHHapticEventParameterIDHapticIntensity value:static_cast<float>(std::max(strong, weak))];
    CHHapticEventParameter *sharpness = [[CHHapticEventParameter alloc] initWithParameterID:CHHapticEventParameterIDHapticSharpness value:static_cast<float>(weak)];
    CHHapticEvent *event = [[CHHapticEvent alloc] initWithEventType:CHHapticEventTypeHapticContinuous parameters:@[intensity, sharpness] relativeTime:0 duration:duration];
    CHHapticPattern *pattern = [[CHHapticPattern alloc] initWithEvents:@[event] parameters:@[] error:&error];
    if (!pattern) return fail(env, "macOS could not create the controller haptic pattern");
    id<CHHapticPatternPlayer> player = [engine createPlayerWithPattern:pattern error:&error];
    if (!player || ![player startAtTime:engine.currentTime + delay error:&error]) return fail(env, "macOS could not play the controller haptic pattern");
    dispatch_after(dispatch_time(DISPATCH_TIME_NOW, static_cast<int64_t>((delay + duration + 0.1) * NSEC_PER_SEC)), dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_DEFAULT, 0), ^{ [player stopAtTime:0 error:nil]; (void)engine; });
  } else if (kind == "key") {
    const CGKeyCode code = key_code(string_property(env, argv[0], "control"));
    if (code == UINT16_MAX) return unsupported(env, "unsupported macOS CGEvent key");
    CGEventRef event = CGEventCreateKeyboardEvent(nullptr, code, bool_property(env, argv[0], "pressed", false));
    if (!event) return fail(env, "macOS could not create keyboard event; grant Accessibility permission");
    CGEventPost(kCGHIDEventTap, event); CFRelease(event);
  } else if (kind == "pointer") {
    const std::string action = string_property(env, argv[0], "action");
    if (action == "pointer:wheel") {
      const int32_t vertical = static_cast<int32_t>(std::max(-4096.0, std::min(4096.0, number_property(env, argv[0], "deltaY", 0))));
      const int32_t horizontal = static_cast<int32_t>(std::max(-4096.0, std::min(4096.0, number_property(env, argv[0], "deltaX", 0))));
      if (!vertical && !horizontal) return fail(env, "empty macOS mouse wheel event");
      CGEventRef event = CGEventCreateScrollWheelEvent(nullptr, kCGScrollEventUnitPixel, 2, vertical, horizontal);
      if (!event) return fail(env, "macOS could not create scroll event; grant Accessibility permission");
      CGEventPost(kCGHIDEventTap, event); CFRelease(event);
      napi_value result; napi_get_boolean(env, true, &result); return result;
    }
    CGEventRef current = CGEventCreate(nullptr);
    if (!current) return fail(env, "macOS could not read pointer position; grant Accessibility permission");
    const CGPoint location = CGEventGetLocation(current); CFRelease(current);
    const CGPoint next = CGPointMake(location.x + number_property(env, argv[0], "deltaX", 0), location.y + number_property(env, argv[0], "deltaY", 0));
    const CGMouseButton button = mouse_button(string_property(env, argv[0], "control"));
    CGEventType event_type = kCGEventMouseMoved;
    if (action == "pointer:down") event_type = kCGEventLeftMouseDown;
    else if (action == "pointer:up" || action == "pointer:cancel") event_type = kCGEventLeftMouseUp;
    if ((action == "pointer:down" || action == "pointer:up" || action == "pointer:cancel") && button == UINT8_MAX) return unsupported(env, "unsupported macOS mouse button event");
    if (event_type == kCGEventLeftMouseDown || event_type == kCGEventLeftMouseUp) {
      if (button == kCGMouseButtonCenter) event_type = event_type == kCGEventLeftMouseDown ? kCGEventOtherMouseDown : kCGEventOtherMouseUp;
      else if (button == kCGMouseButtonRight) event_type = event_type == kCGEventLeftMouseDown ? kCGEventRightMouseDown : kCGEventRightMouseUp;
    }
    CGEventRef event = CGEventCreateMouseEvent(nullptr, event_type, next, button == UINT8_MAX ? kCGMouseButtonLeft : button);
    if (!event) return fail(env, "macOS could not create pointer event; grant Accessibility permission");
    CGEventPost(kCGHIDEventTap, event); CFRelease(event);
  } else {
    return unsupported(env, "macOS native input supports virtual-gamepad, keyboard, pointer, and GameController haptics events only");
  }
  napi_value result; napi_get_boolean(env, true, &result); return result;
}

napi_value close(napi_env env, napi_callback_info) {
  close_virtual_gamepad();
  napi_value result; napi_get_undefined(env, &result); return result;
}

napi_value create_bindings(napi_env env, napi_callback_info) {
  close_virtual_gamepad(); create_virtual_gamepad();
  napi_value result; napi_create_object(env, &result);
  napi_value platform; napi_create_string_utf8(env, "darwin", NAPI_AUTO_LENGTH, &platform); napi_set_named_property(env, result, "platform", platform);
  napi_value capabilities; napi_create_object(env, &capabilities); napi_value true_value; napi_get_boolean(env, true, &true_value); napi_value false_value; napi_get_boolean(env, false, &false_value);
  napi_set_named_property(env, capabilities, "input", true_value); napi_set_named_property(env, capabilities, "keyboard", true_value); napi_set_named_property(env, capabilities, "pointer", true_value); napi_get_boolean(env, virtual_device != nullptr, &true_value); napi_set_named_property(env, capabilities, "gamepad", true_value); napi_set_named_property(env, capabilities, "virtualGamepad", true_value); napi_get_boolean(env, true, &true_value); napi_set_named_property(env, capabilities, "rumble", true_value); napi_set_named_property(env, result, "capabilities", capabilities);
  napi_value input; napi_create_object(env, &input); napi_value execute_fn; napi_create_function(env, "execute", NAPI_AUTO_LENGTH, execute, nullptr, &execute_fn); napi_set_named_property(env, input, "execute", execute_fn); napi_value close_fn; napi_create_function(env, "close", NAPI_AUTO_LENGTH, close, nullptr, &close_fn); napi_set_named_property(env, input, "close", close_fn); napi_set_named_property(env, result, "input", input);
  return result;
}

} // namespace

NAPI_MODULE_INIT() {
  napi_value factory;
  napi_create_function(env, "createBindings", NAPI_AUTO_LENGTH, create_bindings, nullptr, &factory);
  napi_set_named_property(env, exports, "createBindings", factory);
  return exports;
}
