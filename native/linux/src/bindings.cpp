#include <node_api.h>
#include <linux/input-event-codes.h>
#include <linux/uinput.h>
#include <fcntl.h>
#include <unistd.h>
#include <sys/ioctl.h>

#include <cerrno>
#include <cstring>
#include <string>

namespace {

int device_fd = -1;

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

int button_code(const std::string& control) {
  if (control == "a" || control == "south") return BTN_SOUTH;
  if (control == "b" || control == "east") return BTN_EAST;
  if (control == "x" || control == "west") return BTN_WEST;
  if (control == "y" || control == "north") return BTN_NORTH;
  if (control == "lb" || control == "l1") return BTN_TL;
  if (control == "rb" || control == "r1") return BTN_TR;
  if (control == "back" || control == "select") return BTN_SELECT;
  if (control == "start") return BTN_START;
  if (control == "guide") return BTN_MODE;
  if (control == "dpad-up") return BTN_DPAD_UP;
  if (control == "dpad-down") return BTN_DPAD_DOWN;
  if (control == "dpad-left") return BTN_DPAD_LEFT;
  if (control == "dpad-right") return BTN_DPAD_RIGHT;
  return -1;
}

int axis_code(const std::string& control) {
  if (control == "left-x" || control == "lx") return ABS_X;
  if (control == "left-y" || control == "ly") return ABS_Y;
  if (control == "right-x" || control == "rx") return ABS_RX;
  if (control == "right-y" || control == "ry") return ABS_RY;
  if (control == "left-trigger" || control == "lt") return ABS_Z;
  if (control == "right-trigger" || control == "rt") return ABS_RZ;
  return -1;
}

bool write_event(unsigned short type, unsigned short code, int value) {
  if (device_fd < 0) return false;
  input_event event{};
  event.type = type;
  event.code = code;
  event.value = value;
  return write(device_fd, &event, sizeof(event)) == static_cast<ssize_t>(sizeof(event));
}

bool ensure_device() {
  if (device_fd >= 0) return true;
  device_fd = open("/dev/uinput", O_WRONLY | O_NONBLOCK);
  if (device_fd < 0) return false;
  if (ioctl(device_fd, UI_SET_EVBIT, EV_KEY) < 0 || ioctl(device_fd, UI_SET_EVBIT, EV_ABS) < 0) return false;
  const int buttons[] = {BTN_SOUTH, BTN_EAST, BTN_WEST, BTN_NORTH, BTN_TL, BTN_TR, BTN_SELECT, BTN_START, BTN_MODE, BTN_DPAD_UP, BTN_DPAD_DOWN, BTN_DPAD_LEFT, BTN_DPAD_RIGHT};
  for (const int button : buttons) if (ioctl(device_fd, UI_SET_KEYBIT, button) < 0) return false;
  const int axes[] = {ABS_X, ABS_Y, ABS_RX, ABS_RY, ABS_Z, ABS_RZ};
  for (const int axis : axes) if (ioctl(device_fd, UI_SET_ABSBIT, axis) < 0) return false;
  uinput_user_dev device{};
  std::strncpy(device.name, "Spartan Gaming Virtual Gamepad", UINPUT_MAX_NAME_SIZE - 1);
  device.id.bustype = BUS_USB;
  device.id.vendor = 0x5350;
  device.id.product = 0x0001;
  device.id.version = 1;
  for (const int axis : axes) { device.absmin[axis] = -32767; device.absmax[axis] = 32767; }
  if (write(device_fd, &device, sizeof(device)) != static_cast<ssize_t>(sizeof(device)) || ioctl(device_fd, UI_DEV_CREATE) < 0) { close(device_fd); device_fd = -1; return false; }
  usleep(20'000);
  return true;
}

napi_value execute(napi_env env, napi_callback_info info) {
  napi_value argv[1]; size_t argc = 1;
  if (napi_get_cb_info(env, info, &argc, argv, nullptr, nullptr) != napi_ok || argc < 1) return fail(env, "input operation is required");
  const std::string kind = string_property(env, argv[0], "kind");
  if (kind != "button" && kind != "axis") return fail(env, "Linux uinput adapter supports button and axis events only");
  if (!ensure_device()) return fail(env, "unable to open /dev/uinput; grant the host uinput permission");
  if (kind == "button") {
    const int code = button_code(string_property(env, argv[0], "control"));
    if (code < 0) return fail(env, "unsupported Linux virtual-gamepad button");
    if (!write_event(EV_KEY, static_cast<unsigned short>(code), bool_property(env, argv[0], "pressed", false) ? 1 : 0) || !write_event(EV_SYN, SYN_REPORT, 0)) return fail(env, "failed to write Linux virtual-gamepad button event");
  } else {
    const int code = axis_code(string_property(env, argv[0], "control"));
    if (code < 0) return fail(env, "unsupported Linux virtual-gamepad axis");
    const double value = number_property(env, argv[0], "value", 0.0);
    const int normalized = static_cast<int>(value < -1.0 ? -32767 : value > 1.0 ? 32767 : value * 32767.0);
    if (!write_event(EV_ABS, static_cast<unsigned short>(code), normalized) || !write_event(EV_SYN, SYN_REPORT, 0)) return fail(env, "failed to write Linux virtual-gamepad axis event");
  }
  napi_value result; napi_get_boolean(env, true, &result); return result;
}

napi_value close(napi_env env, napi_callback_info) {
  if (device_fd >= 0) { ioctl(device_fd, UI_DEV_DESTROY); ::close(device_fd); device_fd = -1; }
  napi_value result; napi_get_undefined(env, &result); return result;
}

napi_value create_bindings(napi_env env, napi_callback_info) {
  napi_value result; napi_create_object(env, &result);
  napi_value platform; napi_create_string_utf8(env, "linux", NAPI_AUTO_LENGTH, &platform); napi_set_named_property(env, result, "platform", platform);
  napi_value capabilities; napi_create_object(env, &capabilities);
  napi_value true_value; napi_get_boolean(env, access("/dev/uinput", R_OK | W_OK) == 0, &true_value); napi_set_named_property(env, capabilities, "gamepad", true_value);
  napi_value false_value; napi_get_boolean(env, false, &false_value); napi_set_named_property(env, capabilities, "keyboard", false_value); napi_set_named_property(env, capabilities, "pointer", false_value); napi_set_named_property(env, capabilities, "rumble", false_value); napi_set_named_property(env, result, "capabilities", capabilities);
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
