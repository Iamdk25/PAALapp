/** @param {{ role: string, content: string }[]} messages */
export function toChatHistory(messages) {
  return messages.map(({ role, content }) => ({ role, content }))
}
