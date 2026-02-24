function Page({ children, topAlign }) {
  return (
    <div className="container min-vh-100 py-4 py-md-5">
      <div className="row">
        <div className="col-12">
          <div className={`app-page ${topAlign ? 'app-page--top' : 'text-center'}`}>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Page;
