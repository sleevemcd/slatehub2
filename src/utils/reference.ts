export interface ShotTypeInfo {
  icon: string
  fullName: string
  description: string
}

export const SHOT_TYPES: Record<string, ShotTypeInfo> = {
  ECU: { icon: '👁️', fullName: 'Extreme Close Up', description: 'Tight detail — eyes, hands, or object fill the frame' },
  XCU: { icon: '👁️', fullName: 'Extreme Close Up', description: 'Tight detail — eyes, hands, or object fill the frame' },
  CU: { icon: '🔍', fullName: 'Close Up', description: 'Head and shoulders — captures emotion and detail' },
  MCU: { icon: '🎯', fullName: 'Medium Close Up', description: 'Chest up — standard interview / dialogue framing' },
  MS: { icon: '🧑', fullName: 'Medium Shot', description: 'Waist up — balanced between character and environment' },
  MLS: { icon: '🚶', fullName: 'Medium Long Shot', description: 'Knees up — character + significant background' },
  LS: { icon: '🌄', fullName: 'Long Shot', description: 'Full body — character dominates the frame' },
  WS: { icon: '🌄', fullName: 'Wide Shot', description: 'Full body + environment — context is key' },
  EWS: { icon: '🌅', fullName: 'Extreme Wide Shot', description: 'Landscape — character is tiny or absent' },
  OTS: { icon: '👥', fullName: 'Over The Shoulder', description: 'Over one character\'s shoulder at another' },
  POV: { icon: '👀', fullName: 'Point of View', description: 'Seen through a character\'s eyes' },
  '2S': { icon: '👫', fullName: 'Two Shot', description: 'Two characters in frame together' },
  '3S': { icon: '👨‍👩‍👦', fullName: 'Three Shot', description: 'Three characters in frame together' },
  CS: { icon: '🤠', fullName: 'Cowboy Shot', description: 'Mid-thigh up — classic Western framing' },
  Insert: { icon: '✋', fullName: 'Insert Shot', description: 'Close-up of a specific object or detail' },
  Master: { icon: '🎪', fullName: 'Master Shot', description: 'Continuous wide shot covering the entire scene' },
  Dutch: { icon: '🌀', fullName: 'Dutch Angle', description: 'Tilted camera for unease or tension' },
  Aerial: { icon: '🚁', fullName: 'Aerial Shot', description: 'From above — drone, crane, or helicopter' },
  Steadicam: { icon: '🎥', fullName: 'Steadicam Shot', description: 'Smooth moving shot with stabilizer rig' },
  Tracking: { icon: '🛤️', fullName: 'Tracking Shot', description: 'Camera moves alongside the subject' },
}

export function getShotTypeInfo(type: string): ShotTypeInfo {
  const key = type.trim().toUpperCase()
  return SHOT_TYPES[key] || { icon: '🎬', fullName: type || 'Unknown', description: 'See script for framing details' }
}

export function getMediaTypeIcon(type: string): string {
  const lower = type.toLowerCase()
  if (lower.includes('audio') || lower.includes('a-roll') || lower.includes('aroll') || lower.includes('voice') || lower.includes('narration') || lower.includes('interview-audio')) return '🎤'
  if (lower.includes('b-roll') || lower.includes('broll') || lower.includes('cover') || lower.includes('gfx') || lower.includes('graphic')) return '📹'
  if (lower.includes('av') || lower.includes('a/v') || lower.includes('both')) return '🎬'
  return '📷'
}
