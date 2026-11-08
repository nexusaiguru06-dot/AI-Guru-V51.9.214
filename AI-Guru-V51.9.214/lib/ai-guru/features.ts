/**
 * V51.9.122 — features that can be switched off for the whole app without removing their code.
 *
 * AVATARS: the teacher's / student's face in a corner bubble (Reel Studio "Face in the corner", "Make my avatar",
 * the Duet reel, the face in the whole-textbook class and the teacher's video maker, Teacher Portal → My avatar).
 * Turned off to keep AI Guru simple; set to true to bring all of it back.
 */
export const AVATARS = false;

/**
 * V51.9.123 — MISTAKES: the "common mistake" scenes (a wrong line struck out with a red ✗, then the right one), the
 * "Most get it wrong" reel opener and the "Spot the mistake" reel. Turned off: showing the wrong way and striking it
 * out confused students. (Borrowing in subtraction and cancelling terms still cross out, as the textbooks do.)
 */
export const MISTAKES = false;
