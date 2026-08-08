#include <node_api.h>
#include <Carbon/Carbon.h>
#include <CoreGraphics/CoreGraphics.h>
#include <CoreHaptics/CoreHaptics.h>
#include <GameController/GameController.h>
#include <dispatch/dispatch.h>

#include <algorithm>
#include <cmath>
#include <string>

namespace {

napi_value fail(napi_env env, const char* message) {
  napi_throw_error(env, nullptr, message);
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
  if (control == "Space") return kVK_Space; if (control == "Enter") return kVK_Return; if (control == "Escape") return kVK_Escape; if (control == "Tab") return kVK_Tab; if (control == "Backspace") return kVK_Delete; if (control == "Delete") return kVK_ForwardDelete; if (control == "ArrowUp") return kVK_UpArrow; if (control == "ArrowDown") return kVK_DownArrow; if (control == "ArrowLeft") return kVK_LeftArrow; if (control == "ArrowRight") return kVK_RightArrow;
  if (control == "ControlLeft") return kVK_Control; if (control == "ControlRight") return kVK_RightControl; if (control == "ShiftLeft") return kVK_Shift; if (control == "ShiftRight") return kVK_RightShift;
  if (control == "AltLeft") return kVK_Option; if (control == "AltRight") return kVK_RightOption; if (control == "MetaLeft") return kVK_Command; if (control == "MetaRight") return kVK_RightCommand;
  if (control == "CapsLock") return kVK_CapsLock; if (control == "Home") return kVK_Home; if (control == "End") return kVK_End; if (control == "PageUp") return kVK_PageUp; if (control == "PageDown") return kVK_PageDown; if (control == "Insert") return kVK_Help;
  if (control == "F1") return kVK_F1; if (control == "F2") return kVK_F2; if (control == "F3") return kVK_F3; if (control == "F4") return kVK_F4; if (control == "F5") return kVK_F5; if (control == "F6") return kVK_F6;
  if (control == "F7") return kVK_F7; if (control == "F8") return kVK_F8; if (control == "F9") return kVK_F9; if (control == "F10") return kVK_F10; if (control == "F11") return kVK_F11; if (control == "F12") return kVK_F12;
  return UINT16_MAX;
}

CGMouseButton mouse_button(const std::string& control) {
  if (control == "button-0") return kCGMouseButtonLeft;
  if (control == "button-1") return kCGMouseButtonCenter;
  if (control == "button-2") return kCGMouseButtonRight;
  return static_cast<CGMouseButton>(UINT8_MAX);
}

napi_value execute(napi_env env, napi_callback_info info) {
  napi_value argv[1]; size_t argc = 1;
  if (napi_get_cb_info(env, info, &argc, argv, nullptr, nullptr) != napi_ok || argc < 1) return fail(env, "input operation is required");
  const std::string kind = string_property(env, argv[0], "kind");
  if (kind == "rumble") {
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
    if (code == UINT16_MAX) return fail(env, "unsupported macOS CGEvent key");
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
    if ((action == "pointer:down" || action == "pointer:up" || action == "pointer:cancel") && button == UINT8_MAX) return fail(env, "unsupported macOS mouse button event");
    if (event_type == kCGEventLeftMouseDown || event_type == kCGEventLeftMouseUp) {
      if (button == kCGMouseButtonCenter) event_type = event_type == kCGEventLeftMouseDown ? kCGEventOtherMouseDown : kCGEventOtherMouseUp;
      else if (button == kCGMouseButtonRight) event_type = event_type == kCGEventLeftMouseDown ? kCGEventRightMouseDown : kCGEventRightMouseUp;
    }
    CGEventRef event = CGEventCreateMouseEvent(nullptr, event_type, next, button == UINT8_MAX ? kCGMouseButtonLeft : button);
    if (!event) return fail(env, "macOS could not create pointer event; grant Accessibility permission");
    CGEventPost(kCGHIDEventTap, event); CFRelease(event);
  } else {
    return fail(env, "macOS native input supports keyboard, pointer, and GameController haptics events only");
  }
  napi_value result; napi_get_boolean(env, true, &result); return result;
}

napi_value close(napi_env env, napi_callback_info) {
  napi_value result; napi_get_undefined(env, &result); return result;
}

napi_value create_bindings(napi_env env, napi_callback_info) {
  napi_value result; napi_create_object(env, &result);
  napi_value platform; napi_create_string_utf8(env, "darwin", NAPI_AUTO_LENGTH, &platform); napi_set_named_property(env, result, "platform", platform);
  napi_value capabilities; napi_create_object(env, &capabilities); napi_value true_value; napi_get_boolean(env, true, &true_value); napi_value false_value; napi_get_boolean(env, false, &false_value);
  napi_set_named_property(env, capabilities, "input", true_value); napi_set_named_property(env, capabilities, "keyboard", true_value); napi_set_named_property(env, capabilities, "pointer", true_value); napi_set_named_property(env, capabilities, "gamepad", false_value); napi_set_named_property(env, capabilities, "rumble", true_value); napi_set_named_property(env, result, "capabilities", capabilities);
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
