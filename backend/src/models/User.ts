import pool from '../db/pool';
import type { User } from '../types/user';

class UserModel {
  userID: string;
  username: string;
  email: string;
  password: string;
  avatar?: string | null;

  constructor({ userID, username, email, password, avatar }: User) {
    this.userID = userID;
    this.username = username;
    this.email = email;
    this.password = password;
    this.avatar = avatar ?? null;
  }

  async save(): Promise<void> {
    await pool.query(
      'INSERT INTO users (user_id, username, email, password_hash) VALUES ($1, $2, $3, $4)',
      [this.userID, this.username, this.email, this.password],
    );
  }

  static async findById(userID: string): Promise<UserModel | null> {
    const result = await pool.query<User>(
      'SELECT user_id AS "userID", username, email, password_hash AS password, avatar FROM users WHERE user_id = $1',
      [userID],
    );
    const row = result.rows[0];
    if (!row) return null;
    return new UserModel(row);
  }

  static async findByEmail(email: string): Promise<UserModel | null> {
    const result = await pool.query<User>(
      'SELECT user_id AS "userID", username, email, password_hash AS password, avatar FROM users WHERE email = $1',
      [email],
    );
    const row = result.rows[0];
    if (!row) return null;
    return new UserModel(row);
  }
}

export default UserModel;
