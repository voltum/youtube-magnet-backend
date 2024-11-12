export const AppConfig = () => {
  const {
    PORT,
    REDIS_HOST,
    REDIS_PORT,
    USER_DATA_DIR,
    YOUTUBE_API_KEY,
    MONGODB_STRING,
  } = process.env;

  return {
    port: parseInt(PORT, 10) || 3001,
    getUserDataDir: () => {
      return USER_DATA_DIR || ".";
    },
    getRedisHost: () => REDIS_HOST || "localhost",
    getRedisPort: () => Number(REDIS_PORT) || 6379,
    getYoutubeApiKey: () =>
      YOUTUBE_API_KEY || "AIzaSyBquyODQDQl7mf82awWwWZzAUqYBkTRMgQ",
    getMongoDBString: () => MONGODB_STRING,
  };
};
