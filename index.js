require('dotenv').config()
const express = require('express')
const cors = require('cors')
const app = express()
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser')
const port = process.env.PORT || 3000
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

app.use(cors({
  origin: ['http://localhost:5173','https://adorable-axolotl-f0632a.netlify.app'],
  credentials: true
}))
app.use(express.json())
app.use(cookieParser())

const logger = (req, res, next) => {
  console.log('inside logger middleware');
  next()
}

const verifyToken = (req, res, next) => {
  const token = req?.cookies?.token
  console.log('cookie in middleware', token);
  if (!token) {
    return res.status(401).send({ message: 'token nai' })
  }
  //verify token
  jwt.verify(token, process.env.JWT_ACCESS_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).send({ message: 'unauthorized access err' })
    }
    req.decoded = decoded
    next()
  })
}

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(process.env.MONGODB_URI, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {

    const usersCollection = client.db('shareWave').collection('users')
    const articlesCollection = client.db('shareWave').collection('articles')
    const commentsCollection = client.db('shareWave').collection('comments')

    //jwt
    app.post('/jwt', async (req, res) => {
      const userData = req.body
      const token = jwt.sign(userData, process.env.JWT_ACCESS_SECRET, { expiresIn: '1d' }) //token generate
      console.log(token);

      //set token in cookies
      res.cookie('token', token, {
        httpOnly: true,
        secure: true,
        sameSite: "none",
        maxAge: 3*24*60*60*1000
      })
      console.log('Loaded JWT secret:', process.env.JWT_ACCESS_SECRET);

      res.send({ success: true })
    })
    //user
    app.post('/users', async (req, res) => {
      const newUser = req.body;
      console.log(newUser);

      const result = await usersCollection.insertOne(newUser)
      res.send(result)
    })

    app.get('/users', async (req, res) => {
      const email = req.query.email
      // if (email !== req.decoded.email) {
      //   return res.status(403).send({ message: 'forbidden access' })
      // }
      const filter = {}
      if (email) {
        filter.email = email
      }
      const result = await usersCollection.find(filter).toArray();
      res.send(result)
    })
    app.post('/logout', (req, res) => {
      res.clearCookie('token', {
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
        httpOnly: true,
        path: '/', // Same path used when cookie was set
      });

      res.status(200).send({ success: true });
    });

    // article
    app.post('/articles', async (req, res) => {
      const newArticle = req.body
      // console.log(newArticle);
      const result = await articlesCollection.insertOne(newArticle)
      res.send(result)
    })
   app.get('/articles', async (req, res) => {
  const { email, sort } = req.query;
  const filter = email ? { author_email: email } : {};

  let sortOption = {};
  if (sort === 'oldest') {
    sortOption = { date: 1 };  // oldest first
  } else {
    sortOption = { date: -1 }; // newest first
  }

  try {
    const articles = await articlesCollection.find(filter).sort(sortOption).toArray();
    res.send(articles);
  } catch (error) {
    res.status(500).send({ message: 'Failed to fetch articles' });
  }
});


    app.get('/myArticles',logger, verifyToken, async (req, res) => {
      const { email } = req.query;
      const filter = { author_email: email };

      const articles = await articlesCollection.find(filter).toArray();
      res.send(articles)
    })
    app.get('/articles/:id',  async (req, res) => {
      const id = req.params.id;
      const email = req.query.email;
      // if (email !== req.decoded.email) {
      //   return res.status(403).send({ message: 'forbidden access' })
      // }
      const filter = { _id: new ObjectId(id) }
      const result = await articlesCollection.findOne(filter);
      res.send(result)
    })
    app.patch('/like/:articleId', logger, verifyToken, async (req, res) => {
  try {
    const id = req.params.articleId;
    const { email } = req.body;

    if (!email) {
      return res.status(400).send({ message: 'Email is required in request body' });
    }

    // Validate ObjectId
    if (!ObjectId.isValid(id)) {
      return res.status(400).send({ message: 'Invalid article ID' });
    }

    const filter = { _id: new ObjectId(id) };
    const article = await articlesCollection.findOne(filter);

    if (!article) {
      return res.status(404).send({ message: 'Article not found' });
    }

    // Defensive check for likedBy array
    if (!Array.isArray(article.likedBy)) {
      article.likedBy = [];
    }

    const alreadyLiked = article.likedBy.includes(email);

    const updateDoc = alreadyLiked
      ? { $pull: { likedBy: email } }
      : { $addToSet: { likedBy: email } };

    const result = await articlesCollection.updateOne(filter, updateDoc);

    if (result.modifiedCount === 0) {
      return res.status(500).send({ message: 'Failed to update like status' });
    }

    res.send({ liked: !alreadyLiked });
  } catch (error) {
    console.error('Error in /like/:articleId:', error);
    res.status(500).send({ message: 'Internal Server Error' });
  }
});

    app.delete('/articles/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await articlesCollection.deleteOne(query);
      res.send(result)
    });
    app.get('/topLikes', async (req, res) => {
      const result = await articlesCollection.aggregate([{ $addFields: { likeCount: { $size: "$likedBy" } } }, { $sort: { likeCount: -1 } }, { $limit: 6 }]).toArray()
      res.send(result);
    });
    app.get('/categories/:category', async (req, res) => {
      const { category } = req.params
      const filter = { category }
      const result = await articlesCollection.find(filter).toArray()
      res.send(result)
    });
    app.put('/articles/:id', async (req, res) => {
      const { id } = req.params
      const updatedArticle = req.body;

      const filter = { _id: new ObjectId(id) }
      const updatedDoc = {
        $set: updatedArticle
      }
      const result = await articlesCollection.updateOne(filter, updatedDoc)
      res.send(result)
    })

    //comment
    app.post('/comments',logger, verifyToken, async (req, res) => {
      const newComment = req.body
      const result = await commentsCollection.insertOne(newComment)
      res.send(result)
    })
    app.get('/comments', async (req, res) => {
      const article_id = req.query.article_id
      // console.log(article_id);
      const filter = {
        article_id
      }
      const comments = await commentsCollection.find(filter).toArray();
      res.send(comments)
    })


    // await client.db("admin").command({ ping: 1 });
    // console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {

  }
}
run().catch(console.dir);


app.get('/', (req, res) => {
  res.send('share wave starting')
})

app.listen(port, () => {
  console.log(`share wave listening on port ${port}`)
})
