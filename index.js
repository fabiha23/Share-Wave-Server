require('dotenv').config()
const express = require('express')
const cors = require('cors')
const app = express()
const port = process.env.PORT || 3000
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

app.use(cors())
app.use(express.json())


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

    //user
    app.post('/users', async (req, res) => {
      const newUser = req.body;
      console.log(newUser);

      const result = await usersCollection.insertOne(newUser)
      res.send(result)
    })

    app.get('/users', async (req, res) => {
      const email = req.query.email
      const filter = {}
      if (email) {
        filter.email = email
      }
      const result = await usersCollection.find(filter).toArray();
      res.send(result)
    })

    // article
    app.post('/articles', async (req, res) => {
      const newArticle = req.body
      console.log(newArticle);
      const result = await articlesCollection.insertOne(newArticle)
      res.send(result)
    })
    app.get('/articles', async (req, res) => {
      const articles = await articlesCollection.find().toArray();
      res.send(articles)
    })
    app.get('/articles/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) }
      const result = await articlesCollection.findOne(filter);
      res.send(result)
    })
    app.patch('/like/:articleId', async (req, res) => {
      const id = req.params.articleId
      const { email } = req.body
      const filter={ _id: new ObjectId(id) }
      const article = await articlesCollection.findOne(filter)

      const alreadyLiked = article?.likedBy.includes(email)
      const updateDoc = alreadyLiked ? {
        $pull: {
          likedBy: email
        }
      } : {
        $addToSet: {
          likedBy: email
        }
      }
      const result = await articlesCollection.updateOne(filter,updateDoc)
      res.send({liked: !alreadyLiked})
    })


    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
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
