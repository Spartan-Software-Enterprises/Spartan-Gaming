#include <node_api.h>
#define WIN32_LEAN_AND_MEAN
#include <windows.h>

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

LONG number_property(napi_env env, napi_value object, const char* name, LONG fallback) {
  napi_value value;
  if (!property(env, object, name, &value)) return fallback;
  double result = static_cast<double>(fallback);
  napi_get_value_double(env, value, &result);
  return static_cast<LONG>(result);
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

napi_value execute(napi_env env, napi_callback_info info) {
  napi_value argv[1]; size_t argc = 1;
  if (napi_get_cb_info(env, info, &argc, argv, nullptr, nullptr) != napi_ok || argc < 1) return fail(env, "input operation is required");
  const std::string kind = string_property(env, argv[0], "kind");
  INPUT input{};
  input.type = INPUT_KEYBOARD;
  if (kind == "key") {
    const WORD code = key_code(string_property(env, argv[0], "control"));
    if (!code) return fail(env, "unsupported Windows SendInput key");
    input.ki.wVk = code;
    input.ki.dwFlags = bool_property(env, argv[0], "pressed", false) ? 0 : KEYEVENTF_KEYUP;
  } else if (kind == "pointer") {
    input.type = INPUT_MOUSE;
    input.mi.dx = number_property(env, argv[0], "deltaX", 0);
    input.mi.dy = number_property(env, argv[0], "deltaY", 0);
    input.mi.dwFlags = MOUSEEVENTF_MOVE;
  } else {
    return fail(env, "Windows reference input supports keyboard and pointer events only");
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
  napi_set_named_property(env, capabilities, "input", true_value); napi_set_named_property(env, capabilities, "keyboard", true_value); napi_set_named_property(env, capabilities, "pointer", true_value); napi_set_named_property(env, capabilities, "gamepad", false_value); napi_set_named_property(env, capabilities, "rumble", false_value);
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
