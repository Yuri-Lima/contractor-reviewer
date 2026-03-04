export enum AuditAction {
  OPEN_VIEW = 'open_view',
  DOWNLOAD = 'download',
  CHAT_QUERY = 'chat_query',
  REDLINE_GENERATE = 'redline_generate',
  REDLINE_APPLY = 'redline_apply',
  DELETE = 'delete',
  EXPORT_PRIVACY = 'export_privacy',
  UPLOAD = 'upload',
  MEMBER_ADD = 'member_add',
  MEMBER_REMOVE = 'member_remove',
  SETTINGS_UPDATE = 'settings_update',
  PARSER_API_KEY_UPDATE = 'parser_api_key_update',
  VOICE_TRANSCRIBE = 'voice_transcribe',
  TTS_SYNTHESIZE = 'tts_synthesize',
  PROMPT_GENERATE = 'prompt_generate',
}

export enum TargetType {
  DOCUMENT = 'document',
  FILE = 'file',
  WORKSPACE = 'workspace',
  USER = 'user',
  CHAT = 'chat',
  VERSION = 'version',
}
