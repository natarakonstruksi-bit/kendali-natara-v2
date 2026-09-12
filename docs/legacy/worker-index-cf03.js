const COLLECTIONS = new Set([
  "projects",
  "users",
  "rabs",
  "surat",
  "tukang",
  "pelatihan",
  "aset",
  "proyeksi",
  "vendor",
  "po"
]);


function json(data, status = 200, extra = {}) {
  const headers = new Headers({
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    ...extra
  });

  return new Response(
    data === null ? null : JSON.stringify(data),
    {
      status,
      headers
    }
  );
}


function corsHeaders(request) {
  const origin = request.headers.get("origin");

  const headers = {
    "access-control-allow-methods":
      "GET,POST,PUT,PATCH,DELETE,OPTIONS",

    "access-control-allow-headers":
      request.headers.get(
        "access-control-request-headers"
      ) ||
      "authorization,apikey,content-type,prefer",

    "access-control-max-age":
      "86400"
  };

  if (origin) {
    headers["access-control-allow-origin"] = origin;
  }

  return headers;
}


function cleanId(v) {
  const s = String(v ?? "").trim();

  if (!s || s.length > 250) {
    return null;
  }

  return s;
}


/*
====================================
CLOUDFLARE ACCESS AUTH
====================================
*/


async function cloudflareAuthMe(request, env) {

  // Email otomatis dari Cloudflare Access
  const email =
    request.headers.get(
      "Cf-Access-Authenticated-User-Email"
    );


  if (!email) {

    return json({
      ok:false,
      message:
        "Cloudflare Access identity not found"
    },401);

  }


  // Ambil seluruh user dari D1
  const result =
    await env.DB.prepare(`
      SELECT
        id,
        data_json
      FROM app_records
      WHERE collection='users'
    `)
    .all();



  const users =
    (result.results || [])
    .map(row => {

      let data={};

      try {
        data =
          JSON.parse(row.data_json);
      }
      catch(e){}

      return {
        id:row.id,
        ...data
      };

    });



  // Cocokkan email login
  const user =
    users.find(u =>
      String(u.email || "")
      .toLowerCase()
      ===
      String(email)
      .toLowerCase()
    );



  if(!user){

    return json({

      ok:false,

      message:
        "Email belum terdaftar di KENDALI",

      email

    },403);

  }



  return json({

    ok:true,

    identity:{
      email
    },


    user

  });


}
function safeCollection(name){

  return COLLECTIONS.has(name)
    ? name
    : null;

}



function parseInFilter(value){

  if(!value) return [];

  let s = String(value).trim();

  const match =
    s.match(/^in\.\((.*)\)$/s);


  if(!match) return [];


  s = match[1];


  return s
    .split(",")
    .map(x=>{

      x=x.trim();

      if(
        (x.startsWith('"') && x.endsWith('"')) ||
        (x.startsWith("'") && x.endsWith("'"))
      ){
        x=x.slice(1,-1);
      }

      return decodeURIComponent(x);

    })
    .filter(Boolean);

}



/*
====================================
D1 REST GET
====================================
*/


async function restGet(env, collection){


  const result =
    await env.DB.prepare(`
      SELECT
        id,
        data_json,
        updated_at
      FROM app_records
      WHERE collection=?
      ORDER BY updated_at DESC
    `)
    .bind(collection)
    .all();



  const rows =
    (result.results || [])
    .map(row=>({

      id:row.id,

      data:
        JSON.parse(row.data_json),

      updated_at:
        row.updated_at

    }));



  return json(
    rows,
    200,
    {
      "content-range":
        `0-${Math.max(rows.length-1,0)}/${rows.length}`
    }
  );

}



/*
====================================
D1 REST UPSERT
====================================
*/


async function restUpsert(
  request,
  env,
  collection
){


  let payload;


  try{

    payload =
      await request.json();

  }
  catch{

    return json({
      message:"Invalid JSON"
    },400);

  }



  const rows =
    Array.isArray(payload)
      ? payload
      : [payload];



  const now =
    new Date()
    .toISOString();



  const statements=[];
  const audits=[];



  for(const row of rows){


    const id =
      cleanId(row?.id);



    if(!id || row?.data===undefined){

      return json({

        message:
        "Each row requires id and data"

      },400);

    }



    const updatedAt =
      row.updated_at || now;



    statements.push(

      env.DB.prepare(`

        INSERT INTO
        app_records

        (
          collection,
          id,
          data_json,
          updated_at
        )

        VALUES(?,?,?,?)

        ON CONFLICT(collection,id)

        DO UPDATE SET

        data_json=
        excluded.data_json,

        updated_at=
        excluded.updated_at

      `)
      .bind(
        collection,
        id,
        JSON.stringify(row.data),
        updatedAt
      )

    );



    audits.push(

      env.DB.prepare(`

        INSERT INTO
        app_sync_audit

        (
          id,
          collection,
          record_id,
          action
        )

        VALUES(?,?,?,'UPSERT')

      `)
      .bind(
        crypto.randomUUID(),
        collection,
        id
      )

    );


  }



  if(statements.length){

    await env.DB.batch(statements);

  }


  if(audits.length){

    await env.DB.batch(audits);

  }



  return json(
    null,
    201,
    {
      "preference-applied":
      "resolution=merge-duplicates"
    }
  );

}



/*
====================================
D1 DELETE
====================================
*/


async function restDelete(
  request,
  env,
  collection,
  url
){


  const ids =
    parseInFilter(
      url.searchParams.get("id")
    );


  if(!ids.length){

    return json(null,204);

  }



  const statements =
    ids.map(id=>

      env.DB.prepare(`

        DELETE FROM app_records

        WHERE collection=?

        AND id=?

      `)
      .bind(
        collection,
        id
      )

    );



  await env.DB.batch(statements);



  return json(null,204);

}



/*
====================================
R2 STORAGE
====================================
*/


function storageParts(pathname){


  const prefix =
    "/storage/v1/object/";


  if(!pathname.startsWith(prefix))
    return null;



  let rest =
    pathname.slice(prefix.length);



  let isPublic=false;



  if(rest.startsWith("public/")){

    isPublic=true;

    rest =
      rest.slice(7);

  }



  const slash =
    rest.indexOf("/");



  if(slash<1)
    return null;



  return {

    isPublic,

    bucket:
      rest.slice(0,slash),

    key:
      rest.slice(slash+1)

  };

}




async function storageHandler(
  request,
  env,
  url
){


  const parts =
    storageParts(url.pathname);



  if(!parts){

    return json({
      message:"Invalid storage path"
    },400);

  }



  if(parts.bucket !== "kendali-files"){

    return json({
      message:"Bucket not found"
    },404);

  }



  if(
    request.method==="GET" ||
    request.method==="HEAD"
  ){


    const obj =
      await env.FILES.get(parts.key);



    if(!obj){

      return json({
        message:"Object not found"
      },404);

    }



    const headers =
      new Headers();


    obj.writeHttpMetadata(headers);


    headers.set(
      "etag",
      obj.httpEtag
    );



    return new Response(

      request.method==="HEAD"
      ? null
      : obj.body,

      {
        headers
      }

    );


  }



  if(
    request.method==="POST" ||
    request.method==="PUT"
  ){


    await env.FILES.put(
      parts.key,
      request.body,
      {
        httpMetadata:{
          contentType:
          request.headers.get(
            "content-type"
          ) ||
          "application/octet-stream"
        }
      }
    );


    return json({

      Key:
      `${parts.bucket}/${parts.key}`,

      Id:
      crypto.randomUUID()

    });


  }



  if(request.method==="DELETE"){

    await env.FILES.delete(
      parts.key
    );


    return json({});

  }



  return json({
    message:"Method not allowed"
  },405);

}
export default {

  async fetch(request, env) {


    const url =
      new URL(request.url);



    /*
    ===============================
    CORS
    ===============================
    */


    if(request.method==="OPTIONS"){

      return new Response(
        null,
        {
          status:204,
          headers:
          corsHeaders(request)
        }
      );

    }



    /*
    ===============================
    CLOUDFLARE ACCESS LOGIN
    ===============================
    */


    if(
      url.pathname ===
      "/api/auth/me"
    ){

      return cloudflareAuthMe(
        request,
        env
      );

    }





    /*
    ===============================
    HEALTH CHECK
    ===============================
    */


    if(
      url.pathname ===
      "/api/health"
    ){


      let schema=null;
      let records=0;



      try{


        const s =
          await env.DB.prepare(`

            SELECT value

            FROM schema_meta

            WHERE key='schema_version'

          `)
          .first();



        schema =
          s?.value || null;



        const c =
          await env.DB.prepare(`

            SELECT COUNT(*) AS c

            FROM app_records

          `)
          .first();



        records =
          Number(c?.c || 0);



      }
      catch(e){


        return json({

          ok:false,

          error:
          e.message

        },503);


      }



      return json({

        ok:true,

        service:
        "KENDALI Natara V2",

        architecture:
        "Cloudflare Worker",

        database:
        "Cloudflare D1",

        storage:
        "Cloudflare R2",

        schema_version:
        schema,

        records,

        d1_binding:
        Boolean(env.DB),

        r2_binding:
        Boolean(env.FILES)


      });


    }





    /*
    ===============================
    REST API ADAPTER
    ===============================
    */


    if(
      url.pathname.startsWith(
        "/rest/v1/"
      )
    ){


      const collection =
        safeCollection(

          decodeURIComponent(

            url.pathname
            .slice("/rest/v1/".length)
            .split("/")[0]

          )

        );



      if(!collection){

        return json({

          message:
          "Unknown table"

        },404);

      }




      if(request.method==="GET"){

        return restGet(
          env,
          collection
        );

      }



      if(request.method==="POST"){

        return restUpsert(
          request,
          env,
          collection
        );

      }



      if(request.method==="DELETE"){

        return restDelete(
          request,
          env,
          collection,
          url
        );

      }



      return json({

        message:
        "Method not supported"

      },405);


    }





    /*
    ===============================
    R2 FILE STORAGE
    ===============================
    */


    if(
      url.pathname.startsWith(
        "/storage/v1/object/"
      )
    ){

      return storageHandler(
        request,
        env,
        url
      );

    }





    /*
    ===============================
    BLOCK OLD SUPABASE AUTH
    ===============================
    */


    if(
      url.pathname.startsWith(
        "/auth/v1/"
      )
    ){

      return json({

        message:
        "Auth handled by Cloudflare Access"

      },404);


    }




    /*
    ===============================
    FRONTEND
    ===============================
    */


    return env.ASSETS.fetch(
      request
    );


  }

};
