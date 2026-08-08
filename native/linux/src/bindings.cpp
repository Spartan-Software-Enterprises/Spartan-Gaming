#include <node_api.h>
#include <linux/input-event-codes.h>
#include <linux/uinput.h>
#include <fcntl.h>
#include <unistd.h>
#include <sys/ioctl.h>

#include <cerrno>
#include <cstring>
#include <cstdlib>
#include <map>
#include <set>
#include <string>
#include <vector>

namespace {

int device_fd = -1;
int rumble_effect_id = -1;
bool device_readable = false;
unsigned int ff_gain = 0xffff;
std::map<int, ff_effect> rumble_effects;
std::set<int> active_effects;

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
  if (control.rfind("button-", 0) == 0) {
    char* end = nullptr;
    const long index = std::strtol(control.c_str() + 7, &end, 10);
    if (end == control.c_str() + 7 || *end != '\0') return -1;
    const int indexed[] = {BTN_SOUTH, BTN_EAST, BTN_WEST, BTN_NORTH, BTN_TL, BTN_TR, BTN_TL2, BTN_TR2, BTN_SELECT, BTN_START, BTN_THUMBL, BTN_THUMBR, BTN_DPAD_UP, BTN_DPAD_DOWN, BTN_DPAD_LEFT, BTN_DPAD_RIGHT};
    return index >= 0 && index < static_cast<long>(sizeof(indexed) / sizeof(indexed[0])) ? indexed[index] : -1;
  }
  if (control == "a" || control == "south") return BTN_SOUTH;
  if (control == "b" || control == "east") return BTN_EAST;
  if (control == "x" || control == "west") return BTN_WEST;
  if (control == "y" || control == "north") return BTN_NORTH;
  if (control == "lb" || control == "l1") return BTN_TL;
  if (control == "rb" || control == "r1") return BTN_TR;
  if (control == "lt" || control == "l2") return BTN_TL2;
  if (control == "rt" || control == "r2") return BTN_TR2;
  if (control == "l3") return BTN_THUMBL;
  if (control == "r3") return BTN_THUMBR;
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
  if (control == "axis-0") return ABS_X;
  if (control == "axis-1") return ABS_Y;
  if (control == "axis-2") return ABS_RX;
  if (control == "axis-3") return ABS_RY;
  if (control == "axis-4") return ABS_Z;
  if (control == "axis-5") return ABS_RZ;
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
  device_fd = open("/dev/uinput", O_RDWR | O_NONBLOCK);
  device_readable = device_fd >= 0;
  if (device_fd < 0) device_fd = open("/dev/uinput", O_WRONLY | O_NONBLOCK);
  if (device_fd < 0) return false;
  if (ioctl(device_fd, UI_SET_EVBIT, EV_KEY) < 0 || ioctl(device_fd, UI_SET_EVBIT, EV_ABS) < 0 || ioctl(device_fd, UI_SET_EVBIT, EV_FF) < 0 || ioctl(device_fd, UI_SET_FFBIT, FF_RUMBLE) < 0) { close(device_fd); device_fd = -1; return false; }
  const int buttons[] = {BTN_SOUTH, BTN_EAST, BTN_WEST, BTN_NORTH, BTN_TL, BTN_TR, BTN_TL2, BTN_TR2, BTN_SELECT, BTN_START, BTN_MODE, BTN_THUMBL, BTN_THUMBR, BTN_DPAD_UP, BTN_DPAD_DOWN, BTN_DPAD_LEFT, BTN_DPAD_RIGHT};
  for (const int button : buttons) if (ioctl(device_fd, UI_SET_KEYBIT, button) < 0) { close(device_fd); device_fd = -1; return false; }
  const int axes[] = {ABS_X, ABS_Y, ABS_RX, ABS_RY, ABS_Z, ABS_RZ};
  for (const int axis : axes) if (ioctl(device_fd, UI_SET_ABSBIT, axis) < 0) { close(device_fd); device_fd = -1; return false; }
  uinput_user_dev device{};
  std::strncpy(device.name, "Spartan Gaming Virtual Gamepad", UINPUT_MAX_NAME_SIZE - 1);
  device.id.bustype = BUS_USB;
  device.id.vendor = 0x5350;
  device.id.product = 0x0001;
  device.id.version = 1;
  device.ff_effects_max = 16;
  for (const int axis : axes) { device.absmin[axis] = -32767; device.absmax[axis] = 32767; }
  if (write(device_fd, &device, sizeof(device)) != static_cast<ssize_t>(sizeof(device)) || ioctl(device_fd, UI_DEV_CREATE) < 0) { close(device_fd); device_fd = -1; return false; }
  usleep(20'000);
  return true;
}

napi_value execute(napi_env env, napi_callback_info info) {
  napi_value argv[1]; size_t argc = 1;
  if (napi_get_cb_info(env, info, &argc, argv, nullptr, nullptr) != napi_ok || argc < 1) return fail(env, "input operation is required");
  const std::string kind = string_property(env, argv[0], "kind");
  if (kind != "button" && kind != "axis" && kind != "rumble") return fail(env, "Linux uinput adapter supports button, axis, and rumble events only");
  if (!ensure_device()) return fail(env, "unable to open /dev/uinput; grant the host uinput permission");
  if (kind == "rumble") {
    const double value = number_property(env, argv[0], "value", 0.0);
    const double strong = number_property(env, argv[0], "strongMagnitude", value);
    const double weak = number_property(env, argv[0], "weakMagnitude", value);
    const double bounded_strong = strong < 0.0 ? 0.0 : strong > 1.0 ? 1.0 : strong;
    const double bounded_weak = weak < 0.0 ? 0.0 : weak > 1.0 ? 1.0 : weak;
    const double duration = number_property(env, argv[0], "durationMs", 0.0);
    const double delay = number_property(env, argv[0], "startDelay", 0.0);
    ff_effect effect{};
    effect.type = FF_RUMBLE;
    effect.id = rumble_effect_id;
    effect.u.rumble.strong_magnitude = static_cast<__u16>(bounded_strong * 65535.0);
    effect.u.rumble.weak_magnitude = static_cast<__u16>(bounded_weak * 65535.0);
    effect.replay.length = static_cast<__u16>(duration < 0.0 ? 0.0 : duration > 5000.0 ? 5000.0 : duration);
    effect.replay.delay = static_cast<__u16>(delay < 0.0 ? 0.0 : delay > 5000.0 ? 5000.0 : delay);
    if (ioctl(device_fd, EVIOCSFF, &effect) < 0) return fail(env, "failed to upload Linux force-feedback effect");
    rumble_effect_id = effect.id;
    input_event event{};
    event.type = EV_FF;
    event.code = static_cast<unsigned short>(effect.id);
    event.value = 1;
    if (write(device_fd, &event, sizeof(event)) != static_cast<ssize_t>(sizeof(event))) return fail(env, "failed to play Linux force-feedback effect");
    napi_value result; napi_get_boolean(env, true, &result); return result;
  }
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
  if (device_fd >= 0) { if (rumble_effect_id >= 0) ioctl(device_fd, EVIOCRMFF, rumble_effect_id); ioctl(device_fd, UI_DEV_DESTROY); ::close(device_fd); device_fd = -1; rumble_effect_id = -1; }
  device_readable = false;
  ff_gain = 0xffff;
  rumble_effects.clear();
  active_effects.clear();
  napi_value result; napi_get_undefined(env, &result); return result;
}

void push_rumble_state(std::vector<double>& strong, std::vector<double>& weak) {
  double combined_strong = 0.0;
  double combined_weak = 0.0;
  if (!active_effects.empty()) {
    const double gain_scale = static_cast<double>(ff_gain) / 65535.0;
    for (const int id : active_effects) {
      const auto entry = rumble_effects.find(id);
      if (entry == rumble_effects.end()) continue;
      combined_strong += static_cast<double>(entry->second.u.rumble.strong_magnitude) / 65535.0 * gain_scale;
      combined_weak += static_cast<double>(entry->second.u.rumble.weak_magnitude) / 65535.0 * gain_scale;
    }
  }
  strong.push_back(combined_strong > 1.0 ? 1.0 : combined_strong);
  weak.push_back(combined_weak > 1.0 ? 1.0 : combined_weak);
}

napi_value read_ff_events(napi_env env, napi_callback_info) {
  std::vector<double> strong;
  std::vector<double> weak;
  if (device_fd >= 0 && device_readable) {
    for (;;) {
      input_event ev{};
      const ssize_t count = ::read(device_fd, &ev, sizeof(ev));
      if (count == static_cast<ssize_t>(sizeof(ev))) {
        if (ev.type == EV_UINPUT && ev.code == UI_FF_UPLOAD) {
          uinput_ff_upload request{};
          request.request_id = static_cast<__u32>(ev.value);
          if (ioctl(device_fd, UI_BEGIN_FF_UPLOAD, &request) == 0) {
            if (request.effect.type == FF_RUMBLE) rumble_effects[request.effect.id] = request.effect;
            request.retval = 0;
            ioctl(device_fd, UI_END_FF_UPLOAD, &request);
          }
        } else if (ev.type == EV_UINPUT && ev.code == UI_FF_ERASE) {
          uinput_ff_erase request{};
          request.request_id = static_cast<__u32>(ev.value);
          if (ioctl(device_fd, UI_BEGIN_FF_ERASE, &request) == 0) {
            const auto entry = rumble_effects.find(static_cast<int>(request.effect_id));
            if (entry != rumble_effects.end()) {
              rumble_effects.erase(entry);
              if (active_effects.erase(static_cast<int>(request.effect_id))) push_rumble_state(strong, weak);
            }
            request.retval = 0;
            ioctl(device_fd, UI_END_FF_ERASE, &request);
          }
        } else if (ev.type == EV_FF) {
          if (ev.code == FF_GAIN) {
            ff_gain = ev.value < 0 ? 0 : ev.value > 0xffff ? 0xffff : static_cast<unsigned int>(ev.value);
            if (!active_effects.empty()) push_rumble_state(strong, weak);
          } else if (ev.code != FF_AUTOCENTER) {
            const int effect_id = static_cast<int>(ev.code);
            if (ev.value != 0) {
              if (rumble_effects.find(effect_id) != rumble_effects.end()) {
                if (active_effects.insert(effect_id).second) push_rumble_state(strong, weak);
              }
            } else {
              if (active_effects.erase(effect_id)) push_rumble_state(strong, weak);
            }
          }
        }
      } else if (count < 0 && errno == EINTR) {
        continue;
      } else {
        break;
      }
    }
  }
  napi_value result;
  napi_create_array_with_length(env, strong.size(), &result);
  for (size_t index = 0; index < strong.size(); index += 1) {
    napi_value item; napi_create_object(env, &item);
    napi_value s; napi_create_double(env, strong[index], &s); napi_set_named_property(env, item, "strongMagnitude", s);
    napi_value w; napi_create_double(env, weak[index], &w); napi_set_named_property(env, item, "weakMagnitude", w);
    napi_set_element(env, result, index, item);
  }
  return result;
}

napi_value create_bindings(napi_env env, napi_callback_info) {
  napi_value result; napi_create_object(env, &result);
  napi_value platform; napi_create_string_utf8(env, "linux", NAPI_AUTO_LENGTH, &platform); napi_set_named_property(env, result, "platform", platform);
  napi_value capabilities; napi_create_object(env, &capabilities);
  const bool uinput_ready = access("/dev/uinput", W_OK) == 0;
  napi_value true_value; napi_get_boolean(env, uinput_ready, &true_value); napi_set_named_property(env, capabilities, "gamepad", true_value); napi_set_named_property(env, capabilities, "rumble", true_value);
  napi_value false_value; napi_get_boolean(env, false, &false_value); napi_set_named_property(env, capabilities, "keyboard", false_value); napi_set_named_property(env, capabilities, "pointer", false_value); napi_set_named_property(env, result, "capabilities", capabilities);
  napi_value input; napi_create_object(env, &input); napi_value execute_fn; napi_create_function(env, "execute", NAPI_AUTO_LENGTH, execute, nullptr, &execute_fn); napi_set_named_property(env, input, "execute", execute_fn); napi_value close_fn; napi_create_function(env, "close", NAPI_AUTO_LENGTH, close, nullptr, &close_fn); napi_set_named_property(env, input, "close", close_fn); napi_value read_fn; napi_create_function(env, "readRumbleEvents", NAPI_AUTO_LENGTH, read_ff_events, nullptr, &read_fn); napi_set_named_property(env, input, "readRumbleEvents", read_fn); napi_set_named_property(env, result, "input", input);
  return result;
}

} // namespace

NAPI_MODULE_INIT() {
  napi_value factory;
  napi_create_function(env, "createBindings", NAPI_AUTO_LENGTH, create_bindings, nullptr, &factory);
  napi_set_named_property(env, exports, "createBindings", factory);
  return exports;
}
