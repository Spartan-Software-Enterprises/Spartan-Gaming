package com.spartan.gaming.textinput

/**
 * Metadata-only boundary for Android GameTextInput.
 *
 * The actual GameTextInput C API/Prefab binding belongs to the Android native
 * shell. This class keeps requests safe and portable until that shell is
 * compiled with the Android Games SDK and exercised on a real device.
 */
data class AndroidGameTextInputState(
    val text: String,
    val selectionStart: Int,
    val selectionEnd: Int,
    val composingStart: Int = -1,
    val composingEnd: Int = -1,
)

data class AndroidGameTextInputRequest(
    val action: String,
    val userInitiated: Boolean,
    val hasFocus: Boolean,
    val state: AndroidGameTextInputState? = null,
)

object AndroidGameTextInputContract {
    const val maxTextLength = 4096

    fun canShowIme(request: AndroidGameTextInputRequest): Boolean =
        request.action == "show" && request.userInitiated && request.hasFocus

    fun isSafeState(state: AndroidGameTextInputState): Boolean {
        if (state.text.length > maxTextLength || state.text.contains('\u0000')) return false
        if (state.selectionStart !in 0..state.text.length || state.selectionEnd !in 0..state.text.length) return false
        if (state.selectionStart > state.selectionEnd) return false
        val hasComposition = state.composingStart != -1 || state.composingEnd != -1
        return !hasComposition || (state.composingStart in 0..state.text.length && state.composingEnd in state.composingStart..state.text.length)
    }
}
