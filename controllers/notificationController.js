import Notification from '../models/notificationModel.js';

export const getNotifications = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    if (!userId) return res.status(401).json({ msg: 'Unauthorized' });

    const { workspaceId } = req.query;
    const query = { userId, read: false };
    if (workspaceId) query.workspaceId = workspaceId;

    const notifications = await Notification.find(query)
      .populate('from', 'name email avatar')
      .sort({ createdAt: -1 })
      .limit(50);

    res.json({ success: true, notifications });
  } catch (err) {
    console.error('getNotifications', err);
    res.status(500).json({ msg: 'Server error' });
  }
};

export const markAsRead = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    if (!userId) return res.status(401).json({ msg: 'Unauthorized' });

    const { notificationIds } = req.body;
    await Notification.updateMany(
      { _id: { $in: notificationIds }, userId },
      { read: true }
    );

    res.json({ success: true });
  } catch (err) {
    console.error('markAsRead', err);
    res.status(500).json({ msg: 'Server error' });
  }
};

export const createNotification = async (userId, data) => {
  try {
    const notification = new Notification({
      userId,
      workspaceId: data.workspaceId,
      type: data.type,
      from: data.from,
      fromName: data.fromName,
      fromAvatar: data.fromAvatar,
      groupId: data.groupId,
      groupName: data.groupName,
      groupPicture: data.groupPicture,
      title: data.title,
      message: data.message
    });
    await notification.save();
    return notification;
  } catch (err) {
    console.error('createNotification', err);
    return null;
  }
};
