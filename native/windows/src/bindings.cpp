#include <node_api.h>
#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <Xinput.h>

#include <string>
#include <thread>

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

LONG number_property(napi_env env, napi_value object, const char* name, LONG fallback) {
  napi_value value;
  if (!property(env, object, name, &value)) return fallback;
  double result = static_cast<double>(fallback);
  napi_get_value_double(env, value, &result);
  return static_cast<LONG>(result);
}

double double_property(napi_env env, napi_value object, const char* name, double fallback) {
  napi_value value;
  if (!property(env, object, name, &value)) return fallback;
  double result = fallback;
  napi_get_value_double(env, value, &result);
  return result;
}

WORD rumble_magnitude(napi_env env, napi_value object, const char* name, double fallback) {
  const double value = double_property(env, object, name, fallback);
  return static_cast<WORD>(value < 0.0 ? 0.0 : value > 1.0 ? 65535.0 : value * 65535.0);
}

WORD key_code(const std::string& control) {
  if (control.size() == 4 && control.rfind("Key", 0) == 0 && control[3] >= 'A' && control[3] <= 'Z') return static_cast<WORD>(control[3]);
  if (control.size() == 6 && control.rfind("Digit", 0) == 0 && control[5] >= '0' && control[5] <= '9') return static_cast<WORD>(control[5]);
  if (control == "Space") return VK_SPACE;
  if (control == "Enter") return VK_RETURN;
  if (control == "Escape") return VK_ESCAPE;
  if (control == "Tab") return VK_TAB;
  if (control == "Backspace") return VK_BACK;
  if (control == "ArrowUp") return VK_UP;
  if (control == "ArrowDown") return VK_DOWN;
  if (control == "ArrowLeft") return VK_LEFT;
  if (control == "ArrowRight") return VK_RIGHT;
  return 0;
}

DWORD mouse_button_flags(const std::string& control, const std::string& action) {
  DWORD down = 0;
  DWORD up = 0;
  if (control == "button-0") { down = MOUSEEVENTF_LEFTDOWN; up = MOUSEEVENTF_LEFTUP; }
  else if (control == "button-1") { down = MOUSEEVENTF_MIDDLEDOWN; up = MOUSEEVENTF_MIDDLEUP; }
  else if (control == "button-2") { down = MOUSEEVENTF_RIGHTDOWN; up = MOUSEEVENTF_RIGHTUP; }
  else return 0;
  if (action == "pointer:down") return down;
  if (action == "pointer:up" || action == "pointer:cancel") return up;
  return action == "pointer:move" ? MOUSEEVENTF_MOVE : 0;
}

napi_value execute(napi_env env, napi_callback_info info) {
  napi_value argv[1]; size_t argc = 1;
  if (napi_get_cb_info(env, info, &argc, argv, nullptr, nullptr) != napi_ok || argc < 1) return fail(env, "input operation is required");
  const std::string kind = string_property(env, argv[0], "kind");
  if (kind == "rumble") {
    const LONG requested_index = number_property(env, argv[0], "gamepadIndex", 0);
    if (requested_index < 0 || requested_index > 3) return fail(env, "Windows XInput supports gamepad indexes 0 through 3");
    const DWORD index = static_cast<DWORD>(requested_index);
    const LONG duration = number_property(env, argv[0], "durationMs", 0);
    const LONG delay = number_property(env, argv[0], "startDelay", 0);
    const double value = double_property(env, argv[0], "value", 0.0);
    const WORD strong = rumble_magnitude(env, argv[0], "strongMagnitude", value);
    const WORD weak = rumble_magnitude(env, argv[0], "weakMagnitude", value);
    XINPUT_STATE state{};
    if (XInputGetState(index, &state) != ERROR_SUCCESS) return fail(env, "Windows XInput controller is unavailable");
    if (duration <= 0) {
      XINPUT_VIBRATION stop{};
      XInputSetState(index, &stop);
      napi_value result; napi_get_boolean(env, true, &result); return result;
    }
    const auto play = [index, strong, weak, duration, delay]() {
      if (delay > 0) Sleep(static_cast<DWORD>(delay > 5000 ? 5000 : delay));
      XINPUT_VIBRATION vibration{};
      vibration.wLeftMotorSpeed = strong;
      vibration.wRightMotorSpeed = weak;
      if (XInputSetState(index, &vibration) != ERROR_SUCCESS) return;
      Sleep(static_cast<DWORD>(duration > 5000 ? 5000 : duration));
      XINPUT_VIBRATION stop{};
      XInputSetState(index, &stop);
    };
    if (delay > 0) std::thread(play).detach();
    else {
      XINPUT_VIBRATION vibration{};
      vibration.wLeftMotorSpeed = strong;
      vibration.wRightMotorSpeed = weak;
      if (XInputSetState(index, &vibration) != ERROR_SUCCESS) return fail(env, "Windows XInput controller is unavailable");
      if (duration > 0) std::thread([index, duration]() { Sleep(static_cast<DWORD>(duration > 5000 ? 5000 : duration)); XINPUT_VIBRATION stop{}; XInputSetState(index, &stop); }).detach();
    }
    napi_value result; napi_get_boolean(env, true, &result); return result;
  }
  INPUT input{};
  input.type = INPUT_KEYBOARD;
  if (kind == "key") {
    const WORD code = key_code(string_property(env, argv[0], "control"));
    if (!code) return fail(env, "unsupported Windows SendInput key");
    input.ki.wVk = code;
    input.ki.dwFlags = bool_property(env, argv[0], "pressed", false) ? 0 : KEYEVENTF_KEYUP;
  } else if (kind == "pointer") {
    input.type = INPUT_MOUSE;
    const std::string action = string_property(env, argv[0], "action");
    input.mi.dx = number_property(env, argv[0], "deltaX", 0);
    input.mi.dy = number_property(env, argv[0], "deltaY", 0);
    if (action == "pointer:wheel") {
      const LONG horizontal = number_property(env, argv[0], "deltaX", 0);
      const LONG vertical = number_property(env, argv[0], "deltaY", 0);
      if (vertical != 0) { input.mi.dwFlags = MOUSEEVENTF_WHEEL; input.mi.mouseData = vertical > 0 ? WHEEL_DELTA : -WHEEL_DELTA; }
      else if (horizontal != 0) { input.mi.dwFlags = MOUSEEVENTF_HWHEEL; input.mi.mouseData = horizontal > 0 ? WHEEL_DELTA : -WHEEL_DELTA; }
      else return fail(env, "empty Windows mouse wheel event");
      input.mi.dx = 0; input.mi.dy = 0;
    } else input.mi.dwFlags = mouse_button_flags(string_property(env, argv[0], "control"), action);
    if (!input.mi.dwFlags) return fail(env, "unsupported Windows mouse button event");
  } else {
    return fail(env, "Windows native input supports keyboard, pointer, and XInput rumble events only");
  }
  if (SendInput(1, &input, sizeof(INPUT)) != 1) return fail(env, "Windows SendInput failed; grant remote-input permission");
  napi_value result; napi_get_boolean(env, true, &result); return result;
}

napi_value close(napi_env env, napi_callback_info) {
  napi_value result; napi_get_undefined(env, &result); return result;
}

napi_value create_bindings(napi_env env, napi_callback_info) {
  napi_value result; napi_create_object(env, &result);
  napi_value platform; napi_create_string_utf8(env, "win32", NAPI_AUTO_LENGTH, &platform); napi_set_named_property(env, result, "platform", platform);
  napi_value capabilities; napi_create_object(env, &capabilities);
  napi_value true_value; napi_get_boolean(env, true, &true_value);
  napi_value false_value; napi_get_boolean(env, false, &false_value);
  napi_set_named_property(env, capabilities, "input", true_value); napi_set_named_property(env, capabilities, "keyboard", true_value); napi_set_named_property(env, capabilities, "pointer", true_value); napi_set_named_property(env, capabilities, "gamepad", false_value); napi_set_named_property(env, capabilities, "rumble", true_value);
  napi_set_named_property(env, result, "capabilities", capabilities);
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
