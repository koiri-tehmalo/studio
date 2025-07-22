import tensorflow as tf
import tensorflowjs as tfjs

model = tf.keras.models.load_model('./model.h5')
tfjs.converters.save_keras_model(model, './public/model/')
