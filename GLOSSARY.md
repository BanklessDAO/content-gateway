# Domain Glossary

This document contains all the *domain terms* we're using throughout the project. If you're puzzled what a DTO is or how a function with the name pattern `find*` works, then you're at the right place.


## DTO

A DTO (Data Transfer Object) is an object we use to transfer *data* through the [edges](#edge) of the application.


## Edge

Whenever you see *edge(s)* being mentioned it means the boundaries of the application. This is usually represented by an API.
The data structures that pass through the edges are represented by [DTO](#dto)s.