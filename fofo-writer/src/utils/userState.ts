const DEFAULT_STATE = {
  conversation: [
    {
      timestamp: Date.now(),
      role: "assistant",
      content: "Hello!",
    },
  ],
  script: Array.from({ length: 1 }, (_, index) => ({
    timestamp: Date.now() + index,
    role: index % 2 === 0 ? "user" : "assistant",
    content: "",
  })),
};



/**
 * Loads user state from localStorage. Initializes with default state if none exists.
 * @param userId - The unique user ID.
 * @returns The conversation and script state for the user.
 */
export function loadUserState(userId: string) {
  const data = localStorage.getItem(`userState-${userId}`);
  return data ? JSON.parse(data) : DEFAULT_STATE; // Return parsed data or the default state
}

/**
 * Saves user state to localStorage.
 * @param userId - The unique user ID.
 * @param state - The current state of the user's conversation and script.
 */
export function saveUserState(userId: string, state: { conversation: any[]; script: any[] }) {
  localStorage.setItem(`userState-${userId}`, JSON.stringify(state)); // Serialize and save to localStorage
}

// Clear user state from localStorage
export function clearUserState(userId: string) {
  localStorage.removeItem(`userState-${userId}`);
}
