const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const { EsbuildPlugin } = require("esbuild-loader");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const TsconfigPathsPlugin = require("tsconfig-paths-webpack-plugin");
const webpack = require("webpack");
const CopyWebpackPlugin = require("copy-webpack-plugin");

const libConfigESM = {
  name: 'core-esm',
  entry: {
    lib: path.resolve(__dirname, "src", "hypha-core.js"),
  },
  output: {
    filename: "hypha-core.mjs",
    path: path.resolve(__dirname, "dist"),
    library: {
      type: "module",
    },
  },
  experiments: {
    outputModule: true,
  },
  resolve: {
    extensions: [".js"],
    plugins: [],
    fallback: {
      "stream": require.resolve("stream-browserify"),
      "util": require.resolve("util/"),
      "path": require.resolve("path-browserify"),
      "buffer": require.resolve("buffer/"),
      "process": require.resolve("process/browser"),
      "fs": false,
      "module": false,
    },
  },
  module: {
    rules: [
      {
        test: /\.[jt]sx?$/,
        loader: "esbuild-loader",
        options: {
          target: "es2020",
        },
      },
    ],
  },
  optimization: {
    minimizer: [
      new EsbuildPlugin({
        target: "es2020",
        css: true,
        sourcemap: true,
      }),
    ],
  },
};

const libConfigUMD = {
  name: 'core-umd',
  entry: {
    lib: path.resolve(__dirname, "src", "hypha-core.js"),
  },
  output: {
    filename: "hypha-core.umd.js",
    path: path.resolve(__dirname, "dist"),
    library: {
      name: "HyphaCore",
      type: "umd",  // UMD module output
    },
    globalObject: 'this', // Ensures compatibility in different environments
  },
  resolve: {
    extensions: [".js"],
    plugins: [],
    fallback: {
      "stream": require.resolve("stream-browserify"),
      "util": require.resolve("util/"),
      "path": require.resolve("path-browserify"),
      "buffer": require.resolve("buffer/"),
      "process": require.resolve("process/browser"),
      "fs": false,
      "module": false,
    },
  },
  module: {
    rules: [
      {
        test: /\.[jt]sx?$/,
        include: path.resolve(__dirname, "src"), // Only compile files in the src folder
        loader: "esbuild-loader",
        options: {
          target: "es2020",
        },
      },
    ],
  },
  optimization: {
    minimizer: [
      new EsbuildPlugin({
        target: "es2020",
        css: true,
        sourcemap: true,
      }),
    ],
  },
};

const appConfig = {
  name: 'app',
  entry: path.resolve(__dirname, "src", "index.js"),
  output: {
    filename: "[name].js",
    path: path.resolve(__dirname, "dist"),
  },
  plugins: [
    new HtmlWebpackPlugin({
      title: "Hypha Core",
      template: path.resolve(__dirname, "public", "index.html"),
    }),
    new MiniCssExtractPlugin(),
    new webpack.ProvidePlugin({
      process: 'process/browser',
      Buffer: ['buffer', 'Buffer'],
    }),
    new webpack.IgnorePlugin({
      resourceRegExp: /^\.\/locale$/,
      contextRegExp: /moment$/
    }),
    new CopyWebpackPlugin({
      patterns: [
        { from: path.resolve(__dirname, "public", "lite.html"), to: path.resolve(__dirname, "dist") },
        { from: path.resolve(__dirname, "public", "hypha-app-iframe.html"), to: path.resolve(__dirname, "dist") },
        { from: path.resolve(__dirname, "public", "hypha-app-webpython.js"), to: path.resolve(__dirname, "dist") },
        { from: path.resolve(__dirname, "public", "hypha-app-webworker.js"), to: path.resolve(__dirname, "dist") },
      ],
    }),
  ],
  resolve: {
    extensions: [".ts", ".js", ".jsx", ".tsx"],
    plugins: [new TsconfigPathsPlugin()],
    fallback: {
      "stream": require.resolve("stream-browserify"),
      "util": require.resolve("util/"),
      "path": require.resolve("path-browserify"),
      "buffer": require.resolve("buffer/"),
      "process": require.resolve("process/browser"),
      "fs": false
    },
  },
  module: {
    rules: [
      {
        test: /\.[jt]sx?$/,
        loader: "esbuild-loader",
        options: {
          target: "es2020",
          loader: "jsx",
        },
      },
      {
        test: /\.css$/i,
        use: [
          MiniCssExtractPlugin.loader,
          {
            loader: "css-loader",
            options: {
              modules: true,
              importLoaders: 1,
            },
          },
        ],
        include: /\.module\.css$/i,
      },
      {
        test: /\.css$/i,
        use: [MiniCssExtractPlugin.loader, "css-loader"],
        exclude: /\.module\.css$/i,
      },
      {
        test: /\.(png|jpg|jpeg|gif)$/i,
        type: "asset/resource",
      },
      {
        test: /\.svg/,
        use: {
          loader: "svg-url-loader",
          options: {
            encoding: "base64",
            limit: 10000,
          },
        },
      },
    ],
  },
  ignoreWarnings: [
    {
      module: /mocha/,
      message: /the request of a dependency is an expression/
    },
    {
      module: /@babel[\/\\]standalone/,
      message: /the request of a dependency is an expression/
    },
  ],
  optimization: {
    minimizer: [
      new EsbuildPlugin({
        target: "es2020",
        css: true,
        sourcemap: true,
      }),
    ],
  },
  devServer: {
    port: 8080,
    headers: {
      "Access-Control-Allow-Origin": "*",
    },
  },
};

module.exports = [appConfig, libConfigESM, libConfigUMD];
