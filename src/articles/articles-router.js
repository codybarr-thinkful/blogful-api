const path = require('path')
const express = require('express')
const xss = require('xss')
const ArticlesService = require('./articles-service')

const articlesRouter = express.Router()
const jsonParser = express.json()

const sanitizeArticle = article => ({
	...article,
	title: xss(article.title),
	content: xss(article.content)
})

articlesRouter
	.route('/')
	.get((req, res, next) => {
		ArticlesService.getAllArticles(req.app.get('db'))
			.then(articles => {
				res.json(articles.map(sanitizeArticle))
			})
			.catch(next)
	})
	.post(jsonParser, (req, res, next) => {
		const { title, content, style, author } = req.body
		const newArticle = { title, content, style }

		// check for missing fields
		for (const [key, value] of Object.entries(newArticle)) {
			if (value == null) {
				return res.status(400).json({
					error: { message: `Missing '${key}' in request body` }
				})
			}
		}

		newArticle.author = author

		ArticlesService.insertArticle(req.app.get('db'), newArticle)
			.then(article => {
				res.status(201)
					// req.originalUrl (so we don't have to duplicate /api/article in here)
					// req.posix.join so that if the request has a trailing slash it won't come
					// through with a double slash
					.location(path.posix.join(req.originalUrl, `${article.id}`))
					.json(sanitizeArticle(article))
			})
			.catch(next)
	})

articlesRouter
	.route('/:article_id')
	.all((req, res, next) => {
		ArticlesService.getById(req.app.get('db'), req.params.article_id)
			.then(article => {
				if (!article) {
					return res.status(404).json({
						error: { message: `Article doesn't exist` }
					})
				}
				res.article = article // save the article for the next middleware
				next() // don't forget to call next so the next middleware happens!
			})
			.catch(next)
	})
	.get((req, res, next) => {
		res.json(sanitizeArticle(res.article))
	})
	.patch(jsonParser, (req, res, next) => {
		const { title, content, style } = req.body
		const articleToUpdate = { title, content, style }

		if (!title && !content && !style) {
			return res.status(400).json({
				error: {
					message: `Request body must contain either 'title', 'style' or 'content'`
				}
			})
		}

		ArticlesService.updateArticle(
			req.app.get('db'),
			req.params.article_id,
			articleToUpdate
		)
			.then(() => {
				res.status(204).end()
			})
			.catch(next)
	})
	.delete((req, res, next) => {
		ArticlesService.deleteArticle(req.app.get('db'), req.params.article_id)
			.then(() => {
				res.status(204).end()
			})
			.catch(next)
	})

module.exports = articlesRouter
